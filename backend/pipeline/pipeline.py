"""
pipeline.py - Stage 3 of the VarunNetra Forensic Pipeline
===========================================================
Loads the active SVM checkpoint registered in `model_versions`,
runs MNF + SVM pixel classification on a hyperspectral scene,
applies Extended Random Walker (ERW) spatial smoothing, and
records full forensic provenance in Supabase:
  processing_runs -> artifacts -> oil_characterisations -> oil_type_estimates

Outputs:
  - composition_map.png  - quick-look preview
  - composition_map.tif  - georeferenced 1-band mask (uint8, CRS-aware)

Flow:  import_marida.py ──► train_svm.py ──► pipeline.py
"""
import os
import argparse
import hashlib
import traceback
from datetime import datetime, timezone
import numpy as np
import matplotlib.pyplot as plt
import rasterio
from rasterio.transform import from_bounds
import joblib
from pysptools.noise import MNF
from skimage.segmentation import random_walker
from scipy.ndimage import binary_erosion
from supabase import create_client, Client
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')
OUTPUT_PNG = 'composition_map.png'
OUTPUT_TIF = 'composition_map.tif'

def get_supabase_client() -> Client | None:
    print('[Executing Function] get_supabase_client')
    if not SUPABASE_URL or not SUPABASE_KEY:
        print('WARNING: SUPABASE_URL / SUPABASE_KEY not set. Running in offline mode (no DB writes).')
        return None
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def resolve_model_version(sb: Client) -> dict:
    """Query model_versions for the active oil_characterisation model."""
    print('[Executing Function] resolve_model_version')
    resp = sb.table('model_versions').select('*').eq('task', 'oil_characterisation').eq('is_active', True).limit(1).execute()
    if not resp.data:
        raise RuntimeError("No active model in model_versions for task='oil_characterisation'. Run train_svm.py first.")
    row = resp.data[0]
    mv_id = row.get('model_version_id', row.get('id'))
    print(f'  Resolved model_version_id: {mv_id}')
    print(f"  Checkpoint URI: {row.get('checkpoint_uri')}")
    return row

def resolve_spill_id(sb: Client, override: str | None) -> str:
    """Use explicit --spill_id or query the latest uncharacterised spill."""
    print('[Executing Function] resolve_spill_id')
    if override:
        return override
    resp = sb.table('spill_polygons').select('spill_id').order('observed_at', desc=True).limit(1).execute()
    if not resp.data:
        raise RuntimeError('No spill_polygons found. Run import_marida.py first.')
    spill_id = resp.data[0]['spill_id']
    print(f'  Resolved latest spill_id: {spill_id}')
    return spill_id

def load_scene(scene_path: str | None) -> tuple[np.ndarray, dict]:
    """
    Load a GeoTIFF scene via rasterio and return:
      data_cube : np.ndarray of shape (rows, cols, bands)
      geo_profile : dict with 'crs', 'transform', 'height', 'width'

    If scene_path is None, generates a mock cube with a synthetic profile.
    """
    print('[Executing Function] load_scene')
    if scene_path and os.path.exists(scene_path):
        print(f'  Loading scene from {scene_path}...')
        with rasterio.open(scene_path) as src:
            img = src.read()
            data_cube = np.moveaxis(img, 0, -1).astype(np.float64)
            geo_profile = {'crs': src.crs, 'transform': src.transform, 'height': src.height, 'width': src.width}
        return (data_cube, geo_profile)
    print('  No scene file provided - generating mock hyperspectral cube...')
    np.random.seed(42)
    rows, cols, bands = (100, 100, 50)
    data_cube = np.random.rand(rows, cols, bands)
    data_cube[40:60, 40:60, :] += 0.8
    geo_profile = {'crs': rasterio.crs.CRS.from_epsg(4326), 'transform': from_bounds(0, 0, 1, 1, cols, rows), 'height': rows, 'width': cols}
    return (data_cube, geo_profile)

def process_hyperspectral_cube(data_cube: np.ndarray, svm_model, geo_profile: dict, num_components: int=10) -> np.ndarray:
    """
    Phase-2 chemical characterisation:
      1. MNF dimensionality reduction
      2. SVM pixel classification (pre-trained model)
      3. ERW spatial smoothing (first MNF band as guide)

    Verifies that intermediate arrays match the input scene dimensions
    and spatial reference throughout.

    Returns
    -------
    np.ndarray of shape (rows, cols) - uint8, 0 = Seawater, 1 = Oil
    """
    print('[Executing Function] process_hyperspectral_cube')
    rows, cols, bands = data_cube.shape
    assert rows == geo_profile['height'], f"Row mismatch: cube={rows} vs profile={geo_profile['height']}"
    assert cols == geo_profile['width'], f"Col mismatch: cube={cols} vs profile={geo_profile['width']}"
    print('  Applying MNF transform...')
    mnf = MNF()
    mnf_cube = mnf.apply(data_cube)
    n_comp = min(num_components, bands)
    reduced_cube = mnf_cube[:, :, :n_comp]
    flattened = reduced_cube.reshape((rows * cols, n_comp))
    print('  Running SVM classification with loaded checkpoint...')
    svm_predictions = svm_model.predict(flattened)
    classification_map = svm_predictions.reshape((rows, cols))
    print('  Applying Extended Random Walker (ERW) for spatial smoothing...')
    oil_mask = classification_map == 1
    sea_mask = classification_map == 0
    core_oil = binary_erosion(oil_mask, iterations=2)
    core_sea = binary_erosion(sea_mask, iterations=2)
    markers = np.zeros((rows, cols), dtype=int)
    markers[core_sea] = 1
    markers[core_oil] = 2
    guide_image = reduced_cube[:, :, 0]
    assert guide_image.shape == (rows, cols), 'ERW guide image dimension mismatch'
    rw_labels = random_walker(guide_image, markers, beta=10, mode='bf')
    final_map = np.where(rw_labels == 2, 1, 0).astype(np.uint8)
    print('  Pipeline processing complete.')
    return final_map

def sha256_file(path: str) -> str:
    print('[Executing Function] sha256_file')
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

def save_png(result_map: np.ndarray, path: str):
    """Quick-look PNG preview."""
    print('[Executing Function] save_png')
    plt.figure(figsize=(8, 6))
    plt.imshow(result_map, cmap='viridis')
    plt.title('Marine Oil Spill Chemical Composition Map')
    plt.colorbar(label='Classification (0: Seawater, 1: Oil)')
    plt.savefig(path, dpi=150)
    plt.close()
    print(f'  Saved PNG preview -> {path}')

def save_geotiff(result_map: np.ndarray, geo_profile: dict, path: str):
    """
    Export a georeferenced 1-band GeoTIFF (uint8) preserving
    the original scene CRS and affine transform.
    """
    print('[Executing Function] save_geotiff')
    with rasterio.open(path, 'w', driver='GTiff', height=geo_profile['height'], width=geo_profile['width'], count=1, dtype='uint8', crs=geo_profile['crs'], transform=geo_profile['transform']) as dst:
        dst.write(result_map.astype(np.uint8), 1)
    print(f"  Saved GeoTIFF -> {path}  (CRS={geo_profile['crs']})")

def main():
    print('[Executing Function] main')
    parser = argparse.ArgumentParser(description='VarunNetra Phase-2 Chemical Characterisation Pipeline')
    parser.add_argument('--spill_id', type=str, default=None, help='Spill UUID (queries latest if omitted)')
    parser.add_argument('--incident_id', type=str, default=None, help='Incident UUID (optional context)')
    parser.add_argument('--scene', type=str, default=None, help='Path to input GeoTIFF scene (uses mock if omitted)')
    args = parser.parse_args()
    print('=' * 60)
    print('pipeline.py - Phase 2 Characterisation (VarunNetra Stage 3)')
    print('=' * 60)
    sb = get_supabase_client()
    model_version_id = None
    svm_model = None
    spill_id = args.spill_id
    if sb:
        print('\n[1/6] Resolving active model from model_versions...')
        mv_row = resolve_model_version(sb)
        model_version_id = mv_row.get('model_version_id', mv_row.get('id'))
        checkpoint_uri = mv_row.get('checkpoint_uri', '')
        local_path = checkpoint_uri.replace('local://', '')
        print(f"\n[2/6] Loading SVM checkpoint from '{local_path}'...")
        svm_model = joblib.load(local_path)
        print('\n[3/6] Resolving target spill_id...')
        spill_id = resolve_spill_id(sb, args.spill_id)
    else:
        print('\n[Offline] No Supabase connection. Using mock SVM model...')
        from sklearn.svm import SVC
        np.random.seed(42)
        _X = np.random.rand(200, 10)
        _y = np.concatenate([np.zeros(120), np.ones(80)]).astype(int)
        svm_model = SVC(kernel='rbf', random_state=42)
        svm_model.fit(_X, _y)
        spill_id = spill_id or 'offline-mock-spill'
    run_id = None
    if sb:
        print("\n[4/6] Creating processing_run (status='running')...")
        run_resp = sb.table('processing_runs').insert({'run_type': 'characterise', 'status': 'running', 'model_version_id': model_version_id}).execute()
        run_id = run_resp.data[0].get('run_id', run_resp.data[0].get('id'))
        print(f'  run_id: {run_id}')
    try:
        print('\n[5/6] Running characterisation pipeline...')
        data_cube, geo_profile = load_scene(args.scene)
        result_map = process_hyperspectral_cube(data_cube, svm_model, geo_profile)
        save_png(result_map, OUTPUT_PNG)
        save_geotiff(result_map, geo_profile, OUTPUT_TIF)
        if sb:
            tif_hash = sha256_file(OUTPUT_TIF)
            print(f'  GeoTIFF artifact SHA-256: {tif_hash}')
            sb.table('artifacts').insert({'kind': 'mask_raster', 'uri': f'local://{OUTPUT_TIF}', 'sha256': tif_hash, 'created_by_run_id': run_id}).execute()
            print('\n[6/6] Recording characterisation & oil-type estimates...')
            char_resp = sb.table('oil_characterisations').insert({'spill_id': spill_id, 'run_id': run_id, 'method': 'svm', 'status': 'estimated'}).execute()
            char_id = char_resp.data[0].get('characterisation_id', char_resp.data[0].get('id'))
            total_px = result_map.size
            oil_px = int(np.sum(result_map == 1))
            sea_px = int(np.sum(result_map == 0))
            oil_score = oil_px / total_px
            sea_score = sea_px / total_px
            sb.table('oil_type_estimates').insert([{'characterisation_id': char_id, 'oil_class': 'Crude Oil', 'score': round(oil_score, 6)}, {'characterisation_id': char_id, 'oil_class': 'Seawater', 'score': round(sea_score, 6)}]).execute()
            print(f'  Oil:      {oil_score:.4%}  ({oil_px} px)')
            print(f'  Seawater: {sea_score:.4%}  ({sea_px} px)')
            sb.table('processing_runs').update({'status': 'succeeded', 'finished_at': datetime.now(timezone.utc).isoformat()}).eq('run_id', run_id).execute()
        print('\n' + '=' * 60)
        print('CHARACTERISATION COMPLETE')
        print(f'  PNG  : {OUTPUT_PNG}')
        print(f'  TIFF : {OUTPUT_TIF}')
        print('=' * 60)
    except Exception as exc:
        tb = traceback.format_exc()
        print(f'\nERROR during pipeline execution: {exc}\n{tb}')
        if sb and run_id:
            try:
                sb.table('processing_runs').update({'status': 'failed', 'finished_at': datetime.now(timezone.utc).isoformat(), 'error_message': tb[:2000]}).eq('run_id', run_id).execute()
                print("  Updated processing_run status -> 'failed'")
            except Exception as rollback_exc:
                print(f'  Failed to update run status: {rollback_exc}')
        raise
if __name__ == '__main__':
    main()