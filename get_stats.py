import rasterio
import numpy as np
import glob

files = glob.glob("/Users/kingu/11/No_oil/*.tif")[:5]
for f in files:
    with rasterio.open(f) as src:
        data = src.read()
        print(f"File {f}: Min {data.min():.2f}, Max {data.max():.2f}, Mean {data.mean():.2f}, Std {data.std():.2f}")
