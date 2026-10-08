import rasterio
import json
import sys

def inspect_tif(filepath):
    try:
        with rasterio.open(filepath) as src:
            info = {
                "width": src.width,
                "height": src.height,
                "count": src.count,
                "dtypes": src.dtypes,
                "crs": str(src.crs),
                "transform": [t for t in src.transform]
            }
            print(json.dumps(info, indent=2))
    except Exception as e:
        print(f"Error reading file: {e}", file=sys.stderr)

inspect_tif("data_temp/00005.tif")
