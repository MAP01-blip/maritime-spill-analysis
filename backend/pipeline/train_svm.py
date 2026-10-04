"""
train_svm.py - Stage 2 of the VarunNetra Forensic Pipeline
============================================================
Trains an SVM classifier on the MARIDA dataset for binary
Oil (1) vs Seawater (0) pixel classification, saves the model
checkpoint, and upserts a record into the Supabase `model_versions`
table with SHA-256 chain-of-custody hash.

Memory-optimised:
  - Patches are processed sequentially with explicit gc between patches
  - Stratified subsampling caps total pixels to MAX_TRAIN_SAMPLES
  - Majority class (seawater) is down-sampled to CLASS_RATIO × minority

Flow:  import_marida.py ──► train_svm.py ──► pipeline.py
"""
import os
import gc
import json
import hashlib
import traceback
from datetime import datetime, timezone
import numpy as np
import rasterio
from rasterio.features import rasterize
import geopandas as gpd
from pysptools.noise import MNF
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, precision_score, recall_score
import joblib
from supabase import create_client, Client
MARIDA_BASE_DIR = os.environ.get('MARIDA_BASE_DIR', 'MARIDA')
MODEL_OUTPUT_PATH = 'svm_merida_v1.joblib'
NUM_MNF_COMPONENTS = 10
MAX_TRAIN_SAMPLES = 80000
CLASS_RATIO = 2
RANDOM_STATE = 42
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

def get_supabase_client() -> Client | None:
    print('[Executing Function] get_supabase_client')
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def parse_labels_mapping(mapping_path: str) -> dict:
    """
    Parse labels_mapping.txt -> {int_class_id: binary_label}.
      oil -> 1,  water/seawater/background -> 0,  everything else -> -1
    """
    print('[Executing Function] parse_labels_mapping')
    class_mapping = {}
    if not os.path.exists(mapping_path):
        print(f'  Warning: {mapping_path} not found. Using hardcoded defaults.')
        return {1: 0, 2: -1, 3: -1, 4: -1, 5: -1, 6: -1, 7: -1, 8: -1, 9: -1, 10: -1, 11: -1, 12: -1, 13: 0, 14: 0, 15: 1}
    with open(mapping_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split(',')
            if len(parts) < 2:
                continue
            try:
                class_id = int(parts[0].strip())
                class_name = parts[1].strip().lower()
                if 'oil' in class_name:
                    class_mapping[class_id] = 1
                elif any((kw in class_name for kw in ('seawater', 'water', 'background', 'sea'))):
                    class_mapping[class_id] = 0
                else:
                    class_mapping[class_id] = -1
            except ValueError:
                continue
    return class_mapping

def _patch_pixel_generator(filenames: list[str], patches_dir: str, shapes_dir: str, mapping: dict, num_components: int):
    """
    Yields (X_valid, y_valid) arrays for each patch, one at a time.
    After each yield the caller can concatenate or subsample, and the
    previous patch arrays become eligible for garbage collection.
    """
    print('[Executing Function] _patch_pixel_generator')
    for fname in filenames:
        tif_candidates = []
        for root, _, files in os.walk(patches_dir):
            for fp in files:
                if fp.startswith(fname) and fp.endswith('.tif') and ('_cl' not in fp) and ('_conf' not in fp):
                    tif_candidates.append(os.path.join(root, fp))
        shp_path = os.path.join(shapes_dir, f'{fname}.shp')
        if not tif_candidates or not os.path.exists(shp_path):
            continue
        tif_path = tif_candidates[0]
        print(f'  Processing {fname}...')
        with rasterio.open(tif_path) as src:
            img = src.read()
            img = np.moveaxis(img, 0, -1).astype(np.float64)
            transform = src.transform
            shape_2d = (src.height, src.width)
        gdf = gpd.read_file(shp_path)
        shapes = []
        for _, row in gdf.iterrows():
            raw_id = None
            for col in ('class_id', 'Id', 'id', 'CLASS', 'class'):
                if col in row.index:
                    raw_id = row[col]
                    break
            if raw_id is None:
                continue
            shapes.append((row.geometry, mapping.get(int(raw_id), -1)))
        mask = rasterize(shapes, out_shape=shape_2d, transform=transform, fill=-1, dtype='int16') if shapes else np.full(shape_2d, -1, dtype='int16')
        try:
            mnf = MNF()
            mnf_cube = mnf.apply(img)
            n_comp = min(num_components, img.shape[-1])
            reduced = mnf_cube[:, :, :n_comp]
        except Exception as exc:
            print(f'    MNF failed ({exc}), falling back to raw bands')
            reduced = img[:, :, :num_components]
        X_flat = reduced.reshape(-1, reduced.shape[-1])
        y_flat = mask.reshape(-1)
        valid = y_flat != -1
        if valid.sum() == 0:
            del img, mask, reduced, X_flat, y_flat
            gc.collect()
            continue
        X_valid = X_flat[valid]
        y_valid = y_flat[valid]
        del img, mask, reduced, X_flat, y_flat, gdf
        gc.collect()
        yield (X_valid, y_valid)

def stratified_subsample(X: np.ndarray, y: np.ndarray, max_samples: int=MAX_TRAIN_SAMPLES, class_ratio: int=CLASS_RATIO, seed: int=RANDOM_STATE) -> tuple[np.ndarray, np.ndarray]:
    """
    Down-sample so that:
      1. majority_count ≤ class_ratio × minority_count
      2. total_count   ≤ max_samples
    Uses a fixed random seed for reproducibility.
    """
    print('[Executing Function] stratified_subsample')
    rng = np.random.RandomState(seed)
    classes, counts = np.unique(y, return_counts=True)
    class_counts = dict(zip(classes, counts))
    minority_cls = min(class_counts, key=class_counts.get)
    majority_cls = max(class_counts, key=class_counts.get)
    n_minority = class_counts[minority_cls]
    n_majority = class_counts[majority_cls]
    target_majority = min(n_majority, class_ratio * n_minority)
    total = n_minority + target_majority
    if total > max_samples:
        scale = max_samples / total
        n_minority = int(n_minority * scale)
        target_majority = int(target_majority * scale)
    idx_min = np.where(y == minority_cls)[0]
    idx_maj = np.where(y == majority_cls)[0]
    chosen_min = rng.choice(idx_min, size=min(n_minority, len(idx_min)), replace=False)
    chosen_maj = rng.choice(idx_maj, size=min(target_majority, len(idx_maj)), replace=False)
    chosen = np.concatenate([chosen_min, chosen_maj])
    rng.shuffle(chosen)
    print(f'  Subsampled -> {len(chosen_min)} minority + {len(chosen_maj)} majority = {len(chosen)} total  (from {len(y)} raw pixels)')
    return (X[chosen], y[chosen])

def load_and_preprocess_marida(base_dir: str, num_components: int=NUM_MNF_COMPONENTS) -> tuple[np.ndarray, np.ndarray]:
    """
    Orchestrates patch-by-patch loading, then applies stratified subsampling
    to produce a balanced, memory-safe training set.
    """
    print('[Executing Function] load_and_preprocess_marida')
    splits_dir = os.path.join(base_dir, 'splits')
    patches_dir = os.path.join(base_dir, 'patches')
    shapes_dir = os.path.join(base_dir, 'shapefiles')
    mapping_path = os.path.join(base_dir, 'labels_mapping.txt')
    train_txt = os.path.join(splits_dir, 'train.txt')
    mapping = parse_labels_mapping(mapping_path)
    if not os.path.exists(train_txt):
        print(f"  Warning: '{train_txt}' not found. Generating mock training data...")
        np.random.seed(RANDOM_STATE)
        X_mock = np.random.rand(1000, num_components)
        y_mock = np.concatenate([np.zeros(600), np.ones(400)]).astype(int)
        return (X_mock, y_mock)
    with open(train_txt, 'r') as f:
        filenames = [line.strip() for line in f if line.strip()]
    print(f'  Found {len(filenames)} patches in train.txt')
    X_parts: list[np.ndarray] = []
    y_parts: list[np.ndarray] = []
    for X_patch, y_patch in _patch_pixel_generator(filenames, patches_dir, shapes_dir, mapping, num_components):
        X_parts.append(X_patch)
        y_parts.append(y_patch)
    if X_parts:
        X_all = np.vstack(X_parts)
        y_all = np.concatenate(y_parts)
        del X_parts, y_parts
        gc.collect()
    else:
        print('  No valid labelled pixels found. Generating mock training data...')
        np.random.seed(RANDOM_STATE)
        X_all = np.random.rand(1000, num_components)
        y_all = np.concatenate([np.zeros(600), np.ones(400)]).astype(int)
    X_train, y_train = stratified_subsample(X_all, y_all)
    del X_all, y_all
    gc.collect()
    return (X_train, y_train)

def train_model(X: np.ndarray, y: np.ndarray) -> tuple[SVC, dict]:
    """Train SVM and return (model, metrics_dict)."""
    print('[Executing Function] train_model')
    print('Training SVM classifier (RBF kernel, probability=True)...')
    svm = SVC(kernel='rbf', probability=True, random_state=RANDOM_STATE)
    svm.fit(X, y)
    preds = svm.predict(X)
    metrics = {'accuracy': float(accuracy_score(y, preds)), 'precision': float(precision_score(y, preds, zero_division=0)), 'recall': float(recall_score(y, preds, zero_division=0))}
    print(f"  Accuracy:  {metrics['accuracy']:.4f}\n  Precision: {metrics['precision']:.4f}\n  Recall:    {metrics['recall']:.4f}")
    return (svm, metrics)

def sha256_file(path: str) -> str:
    print('[Executing Function] sha256_file')
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

def register_model(sb: Client, metrics: dict, checkpoint_sha256: str) -> str | None:
    """
    Upsert into `model_versions`. Returns model_version_id on success.
    """
    print('[Executing Function] register_model')
    record = {'name': 'svm-merida-characterisation', 'version': '1.0', 'task': 'oil_characterisation', 'framework': 'scikit-learn', 'checkpoint_uri': f'local://{MODEL_OUTPUT_PATH}', 'checkpoint_sha256': checkpoint_sha256, 'metrics': metrics, 'is_active': True}
    resp = sb.table('model_versions').upsert(record, on_conflict='name,version').execute()
    model_version_id = resp.data[0].get('model_version_id', resp.data[0].get('id'))
    print(f'  Registered model_version_id: {model_version_id}')
    return model_version_id

def main():
    print('[Executing Function] main')
    print('=' * 60)
    print('train_svm.py - MARIDA SVM Training  (VarunNetra Stage 2)')
    print('=' * 60)
    sb = get_supabase_client()
    run_id = None
    try:
        if sb:
            print("\n[0/4] Opening processing_run (status='running')...")
            run_resp = sb.table('processing_runs').insert({'run_type': 'train', 'status': 'running'}).execute()
            run_id = run_resp.data[0].get('run_id', run_resp.data[0].get('id'))
            print(f'  run_id: {run_id}')
        print('\n[1/4] Loading & preprocessing MARIDA dataset...')
        X_train, y_train = load_and_preprocess_marida(MARIDA_BASE_DIR)
        print(f'  Final training set: {len(y_train)} pixels  (Oil: {int((y_train == 1).sum())}, Seawater: {int((y_train == 0).sum())})')
        print('\n[2/4] Training model...')
        svm_model, metrics = train_model(X_train, y_train)
        print(f'\n[3/4] Saving checkpoint -> {MODEL_OUTPUT_PATH}')
        joblib.dump(svm_model, MODEL_OUTPUT_PATH)
        ckpt_hash = sha256_file(MODEL_OUTPUT_PATH)
        print(f'  SHA-256: {ckpt_hash}')
        model_version_id = None
        if sb:
            print('\n[4/4] Registering model in Supabase model_versions...')
            model_version_id = register_model(sb, metrics, ckpt_hash)
            sb.table('processing_runs').update({'status': 'succeeded', 'finished_at': datetime.now(timezone.utc).isoformat()}).eq('run_id', run_id).execute()
        else:
            print('\n[4/4] Skipping Supabase registration (no credentials).')
        print('\n' + '=' * 60)
        print('TRAINING COMPLETE')
        print(f'  Checkpoint : {MODEL_OUTPUT_PATH}')
        print(f'  SHA-256    : {ckpt_hash}')
        if model_version_id:
            print(f'  model_version_id : {model_version_id}')
        print('=' * 60)
    except Exception as exc:
        tb = traceback.format_exc()
        print(f'\nERROR during training: {exc}\n{tb}')
        if sb and run_id:
            try:
                sb.table('processing_runs').update({'status': 'failed', 'finished_at': datetime.now(timezone.utc).isoformat(), 'error_message': tb[:2000]}).eq('run_id', run_id).execute()
                print("  Updated processing_run status -> 'failed'")
            except Exception as rollback_exc:
                print(f'  Failed to update run status: {rollback_exc}')
        raise
if __name__ == '__main__':
    main()