import glob
import rasterio
import os

no_oil_files = glob.glob("/Users/kingu/11/No_oil/*.tif")
lookalike_files = glob.glob("/Users/kingu/11/Lookalike/*.tif")

def check_files(files):
    for f in files[:5]: # check a few
        with rasterio.open(f) as src:
            print(f"{os.path.basename(f)}: {src.count} bands, shape {src.shape}")

print("No_oil:")
check_files(no_oil_files)

print("Lookalike:")
check_files(lookalike_files)
