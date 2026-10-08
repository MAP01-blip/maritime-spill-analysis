import torch
from torch.utils.data import Dataset
import numpy as np
import rasterio
import os
import glob

class SARDataset(Dataset):
    """
    OilTrace PyTorch Dataset for Sentinel-1 SAR Imagery.
    Provides paired image [2, 512, 512] and mask [1, 512, 512] tensors.
    """
    def __init__(self, images_dir, masks_dir, transform=None, mock_mode=False, num_mock_samples=100):
        """
        Args:
            images_dir (str): Directory with input .tif images
            masks_dir (str): Directory with ground truth .tif masks
            transform (callable, optional): Optional transform to be applied
            mock_mode (bool): If True, generates synthetic random tensors instead of reading files.
            num_mock_samples (int): Number of synthetic samples to simulate if mock_mode is True.
        """
        self.images_dir = images_dir
        self.masks_dir = masks_dir
        self.transform = transform
        self.mock_mode = mock_mode
        self.num_mock_samples = num_mock_samples

        if self.mock_mode:
            print(f"[WARNING] SARDataset initialized in MOCK MODE. Generating {self.num_mock_samples} synthetic samples.")
            self.image_files = [f"mock_image_{i}.tif" for i in range(self.num_mock_samples)]
            self.mask_files = [f"mock_mask_{i}.tif" for i in range(self.num_mock_samples)]
        else:
            self.image_files = sorted(glob.glob(os.path.join(images_dir, "*.tif")))
            self.mask_files = sorted(glob.glob(os.path.join(masks_dir, "*.tif")))
            
            if len(self.image_files) == 0:
                raise ValueError(f"No .tif files found in {images_dir}")
            
            if len(self.image_files) != len(self.mask_files):
                raise ValueError(f"Mismatch in dataset size: {len(self.image_files)} images vs {len(self.mask_files)} masks.")

    def __len__(self):
        return len(self.image_files)

    def __getitem__(self, idx):
        if self.mock_mode:
            # Generate synthetic VV and VH data
            vv = np.random.normal(-10, 3, (512, 512)).astype(np.float32)
            vh = np.random.normal(-18, 4, (512, 512)).astype(np.float32)
            
            # Generate synthetic binary mask
            mask_np = np.zeros((1, 512, 512), dtype=np.float32)
            mask_np[0, 200:300, 200:300] = 1.0
            
            # Inject a clear learnable signal: make the oil spill dark in VV and VH
            vv[200:300, 200:300] -= 15.0
            vh[200:300, 200:300] -= 15.0
            
            image_tensor = torch.from_numpy(np.stack([vv, vh], axis=0))
            mask_tensor = torch.from_numpy(mask_np)
            
            return image_tensor, mask_tensor

        # Real data loading
        img_path = self.image_files[idx]
        mask_path = self.mask_files[idx]

        with rasterio.open(img_path) as src:
            image_np = src.read() # Expected shape: (2, H, W)
            
        with rasterio.open(mask_path) as src:
            mask_np = src.read() # Expected shape: (1, H, W)

        # Ensure float32
        image_np = image_np.astype(np.float32)
        mask_np = mask_np.astype(np.float32)

        # Convert to tensor
        image_tensor = torch.from_numpy(image_np)
        mask_tensor = torch.from_numpy(mask_np)

        if self.transform:
            image_tensor, mask_tensor = self.transform(image_tensor, mask_tensor)

        return image_tensor, mask_tensor
