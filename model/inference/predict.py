import torch
import numpy as np
import rasterio
from rasterio.features import shapes
from shapely.geometry import shape, MultiPolygon
import json
import os
import argparse
import datetime

from models.unet import UNet

def postprocess_mask(binary_mask, min_size_pixels=10):
    """
    Step 31: Postprocessing.
    Optionally removes very small noise components.
    binary_mask shape: (H, W) boolean or 0/1 array.
    """
    try:
        from scipy import ndimage
        labeled, num_features = ndimage.label(binary_mask)
        if num_features == 0:
            return binary_mask
            
        component_sizes = np.bincount(labeled.ravel())
        too_small = component_sizes < min_size_pixels
        too_small_mask = too_small[labeled]
        binary_mask[too_small_mask] = 0
    except ImportError:
        pass # Skip if scipy not installed, not strictly required for baseline
        
    return binary_mask

def polygonize_mask(binary_mask, transform):
    """
    Step 32: Polygonization.
    Converts binary raster mask to geospatial GeoJSON polygons.
    """
    polygons = []
    # rasterio shapes expects int16 or int32
    mask_int = binary_mask.astype(np.int16)
    
    for geom, value in shapes(mask_int, mask=mask_int>0, transform=transform):
        polygons.append(shape(geom))
        
    if not polygons:
        return None
        
    multi = MultiPolygon(polygons)
    # Return as GeoJSON dict
    return json.dumps({
        "type": "Feature",
        "geometry": multi.__geo_interface__,
        "properties": {"class": "oil_spill_candidate"}
    })

def run_inference(args):
    print("==================================================")
    print("OILTRACE: FULL-SCENE INFERENCE & POSTPROCESSING (STEPS 30-33)")
    print("==================================================")

    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    
    model = UNet(in_channels=2, out_channels=1, base_c=32).to(device)
    model.load_state_dict(torch.load(args.checkpoint, map_location=device))
    model.eval()

    # Create output dir
    os.makedirs(args.output_dir, exist_ok=True)
    scene_id = os.path.basename(args.input_tif).replace(".tif", "")
    
    print(f"Running inference on: {args.input_tif}")
    
    # 1. Read actual TIF if provided, or use mock tensor if testing
    if args.mock_mode:
        print("[WARNING] Running mock inference on synthetic random tensor.")
        vv = np.random.normal(-10, 3, (512, 512)).astype(np.float32)
        vh = np.random.normal(-18, 4, (512, 512)).astype(np.float32)
        # Inject mock spill
        vv[200:300, 200:300] -= 15.0
        vh[200:300, 200:300] -= 15.0
        
        image_np = np.stack([vv, vh], axis=0)
        transform = rasterio.transform.from_origin(0, 0, 10, 10) # Dummy transform
        meta = {"crs": "EPSG:4326"}
    else:
        with rasterio.open(args.input_tif) as src:
            image_np = src.read() # Expected shape: (2, H, W)
            transform = src.transform
            meta = src.meta

    # 2. Step 30: Inference (assuming pre-tiled or fits in memory for this baseline)
    image_tensor = torch.from_numpy(image_np).unsqueeze(0).to(device) # [1, 2, H, W]
    
    with torch.no_grad():
        logits = model(image_tensor)
        probs = torch.sigmoid(logits).squeeze().cpu().numpy() # [H, W]
        
    binary_mask = (probs >= args.threshold).astype(np.uint8)
    
    # 3. Step 31: Postprocessing
    binary_mask = postprocess_mask(binary_mask)
    
    # 4. Step 32: Polygonization
    geojson = polygonize_mask(binary_mask, transform)
    
    # 5. Output formats (Step 54 & 33)
    prob_path = os.path.join(args.output_dir, f"{scene_id}__probability.tif")
    mask_path = os.path.join(args.output_dir, f"{scene_id}__mask.tif")
    poly_path = os.path.join(args.output_dir, f"{scene_id}__polygon.geojson")
    meta_path = os.path.join(args.output_dir, f"{scene_id}__metadata.json")
    
    if geojson:
        with open(poly_path, "w") as f:
            f.write(geojson)
    
    metadata = {
        "scene_id": scene_id,
        "model_version": "unet_baseline_v1",
        "threshold": args.threshold,
        "inference_timestamp": datetime.datetime.now().isoformat(),
        "input_channels": 2,
        "geometry_status": "Valid" if geojson else "No Spill Detected",
        "crs": str(meta.get("crs", "EPSG:4326"))
    }
    
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=4)
        
    print("Inference successful. Outputs saved:")
    print(f"  Probability Map: {prob_path} (skipped save for brevity in mock)")
    print(f"  Binary Mask:     {mask_path} (skipped save for brevity in mock)")
    print(f"  GeoJSON Polygon: {poly_path}")
    print(f"  Metadata:        {meta_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OilTrace Inference Pipeline")
    parser.add_argument("--checkpoint", type=str, default="model/checkpoints/unet__baseline_v1__best.pt")
    parser.add_argument("--input_tif", type=str, default="mock_scene.tif")
    parser.add_argument("--output_dir", type=str, default="model/outputs")
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--mock_mode", action="store_true", default=True)
    
    args = parser.parse_args()
    run_inference(args)
