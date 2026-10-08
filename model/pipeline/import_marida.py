"""
import_marida.py - Stage 1 of the VarunNetra Forensic Pipeline
===============================================================
Reads MARIDA shapefiles, ensures parent seed records exist in
Supabase PostGIS, then inserts ground-truth polygons into the
`spill_polygons` table with all required foreign keys and computed
spatial columns (centroid, area_m2).

Flow:  import_marida.py ──► train_svm.py ──► pipeline.py
"""
import os
import uuid
from datetime import datetime, timezone
import geopandas as gpd
from shapely.geometry import MultiPolygon
from shapely.ops import transform as shapely_transform
import pyproj
from supabase import create_client, Client
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')
SHAPEFILE_DIR = os.environ.get('MARIDA_SHAPEFILES', 'C:\\Users\\mahar\\Documents\\SIH 2026\\MARIDA\\shapefiles')

def get_supabase_client() -> Client:
    """Initialize and return the Supabase client."""
    print('[Executing Function] get_supabase_client')
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError('SUPABASE_URL and SUPABASE_KEY environment variables must be set.')
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def ensure_seed_records(sb: Client) -> dict:
    """
    Verify or insert minimal parent records required by spill_polygons:
      data_sources  ──►  satellite_scenes  ──►  processing_runs  ──►  detections
    Returns a dict of the UUIDs created/found.
    """
    print('[Executing Function] ensure_seed_records')
    now_iso = datetime.now(timezone.utc).isoformat()
    ds_resp = sb.table('data_sources').select('source_id').eq('name', 'MARIDA_GROUND_TRUTH').execute()
    if ds_resp.data:
        source_id = ds_resp.data[0]['source_id']
        print(f'  Found existing data_source: {source_id}')
    else:
        source_id = str(uuid.uuid4())
        sb.table('data_sources').insert({'source_id': source_id, 'name': 'MARIDA_GROUND_TRUTH', 'source_type': 'shapefile', 'description': 'MARIDA Marine Debris Archive ground-truth annotations'}).execute()
        print(f'  Inserted data_source: {source_id}')
    scene_resp = sb.table('satellite_scenes').select('scene_id').eq('source_id', source_id).execute()
    if scene_resp.data:
        scene_id = scene_resp.data[0]['scene_id']
        print(f'  Found existing satellite_scene: {scene_id}')
    else:
        scene_id = str(uuid.uuid4())
        sb.table('satellite_scenes').insert({'scene_id': scene_id, 'source_id': source_id, 'acquired_at': now_iso, 'platform': 'Sentinel-2', 'sensor': 'MSI'}).execute()
        print(f'  Inserted satellite_scene: {scene_id}')
    run_resp = sb.table('processing_runs').select('run_id').eq('run_type', 'scene_ingest').eq('status', 'succeeded').execute()
    if run_resp.data:
        run_id = run_resp.data[0]['run_id']
        print(f'  Found existing processing_run: {run_id}')
    else:
        run_id = str(uuid.uuid4())
        sb.table('processing_runs').insert({'run_id': run_id, 'run_type': 'scene_ingest', 'status': 'succeeded', 'finished_at': now_iso}).execute()
        print(f'  Inserted processing_run: {run_id}')
    det_resp = sb.table('detections').select('detection_id').eq('scene_id', scene_id).execute()
    if det_resp.data:
        detection_id = det_resp.data[0]['detection_id']
        print(f'  Found existing detection: {detection_id}')
    else:
        detection_id = str(uuid.uuid4())
        sb.table('detections').insert({'detection_id': detection_id, 'scene_id': scene_id, 'run_id': run_id, 'detected_at': now_iso}).execute()
        print(f'  Inserted detection: {detection_id}')
    return {'source_id': source_id, 'scene_id': scene_id, 'run_id': run_id, 'detection_id': detection_id}
_wgs84 = pyproj.CRS('EPSG:4326')
_metric = pyproj.CRS('EPSG:3857')
_project_to_metric = pyproj.Transformer.from_crs(_wgs84, _metric, always_xy=True).transform

def to_multipolygon(geom):
    """Ensure geometry is a MultiPolygon."""
    print('[Executing Function] to_multipolygon')
    if geom.geom_type == 'Polygon':
        return MultiPolygon([geom])
    elif geom.geom_type == 'MultiPolygon':
        return geom
    else:
        raise ValueError(f'Unexpected geometry type: {geom.geom_type}')

def compute_area_m2(geom_4326):
    """Project a WGS-84 geometry to EPSG:3857 and return area in m²."""
    print('[Executing Function] compute_area_m2')
    projected = shapely_transform(_project_to_metric, geom_4326)
    return projected.area

def ingest_shapefiles(sb: Client, seeds: dict, shapefile_dir: str):
    """
    Iterate over shapefiles, convert geometries, compute centroid & area,
    and insert rows into the `spill_polygons` table.
    """
    print('[Executing Function] ingest_shapefiles')
    shp_files = [f for f in os.listdir(shapefile_dir) if f.endswith('.shp')]
    if not shp_files:
        print(f'No .shp files found in {shapefile_dir}')
        return
    inserted = 0
    for shp_file in shp_files:
        shp_path = os.path.join(shapefile_dir, shp_file)
        print(f'Reading {shp_file}...')
        gdf = gpd.read_file(shp_path)
        if gdf.crs and gdf.crs != _wgs84:
            gdf = gdf.to_crs('EPSG:4326')
        for _, row in gdf.iterrows():
            geom = to_multipolygon(row.geometry)
            centroid = geom.centroid
            area_m2 = compute_area_m2(geom)
            record = {'spill_id': str(uuid.uuid4()), 'detection_id': seeds['detection_id'], 'observed_at': datetime.now(timezone.utc).isoformat(), 'geom': geom.wkt, 'centroid': centroid.wkt, 'area_m2': round(area_m2, 2), 'model_confidence': 1.0, 'classification': 'oil'}
            sb.table('spill_polygons').insert(record).execute()
            inserted += 1
    print(f'Inserted {inserted} spill polygon(s) into spill_polygons.')

def main():
    print('[Executing Function] main')
    print('=' * 60)
    print('MARIDA -> spill_polygons  (VarunNetra Ground-Truth Ingest)')
    print('=' * 60)
    sb = get_supabase_client()
    print('\n[1/2] Ensuring seed parent records...')
    seeds = ensure_seed_records(sb)
    print('\n[2/2] Ingesting shapefiles into spill_polygons...')
    ingest_shapefiles(sb, seeds, SHAPEFILE_DIR)
    print('\nDone.')
if __name__ == '__main__':
    main()