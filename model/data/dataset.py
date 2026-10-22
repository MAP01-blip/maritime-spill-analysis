import torch
from torch.utils.data import Dataset
import numpy as np
import rasterio
from rasterio.windows import Window
import os
import glob
import random

# Pre-computed train set normalization statistics (from 360 train scenes, seed=42)
SAR_TRAIN_MEAN = [-25.7519, -19.5588]  # [VV, VH] in dB
SAR_TRAIN_STD  = [9.6918, 8.4986]     # [VV, VH] in dB

def get_scene_splits(data_root="/Users/kingu/11/02_Test_images_and_ground_truth", train_ratio=0.8, seed=42):
    """
    Step 16: Scene-level split BEFORE tiling to prevent data leakage.
    Returns:
        train_scenes: list of tuples (img_path, mask_path, category)
        val_scenes:   list of tuples (img_path, mask_path, category)
    """
    random.seed(seed)
    train_scenes = []
    val_scenes = []

    for cat in ["Oil", "Lookalike", "No oil"]:
        img_dir = os.path.join(data_root, "Images", cat)
        mask_dir = os.path.join(data_root, "Mask", cat)
        imgs = sorted(glob.glob(os.path.join(img_dir, "*.tif")))
        random.shuffle(imgs)

        n_train = int(len(imgs) * train_ratio)
        for p in imgs[:n_train]:
            mask_p = os.path.join(mask_dir, os.path.basename(p).replace(".tif", "_segmentation.tif"))
            train_scenes.append((p, mask_p, cat))
        for p in imgs[n_train:]:
            mask_p = os.path.join(mask_dir, os.path.basename(p).replace(".tif", "_segmentation.tif"))
            val_scenes.append((p, mask_p, cat))

    return train_scenes, val_scenes

class SARDataset(Dataset):
    """
    OilTrace PyTorch Dataset for Sentinel-1 SAR Imagery.
    Extracts 512x512 tiles from 2048x2048 scenes using rasterio windowed reading.
    Provides paired image [2, 512, 512] and mask [1, 512, 512] tensors.
    """
    def __init__(
        self,
        scene_list=None,
        data_root=None,
        transform=None,
        mock_mode=False,
        num_mock_samples=100,
        tile_size=512,
        normalize=True,
        augment=False,
        balance_ratio=1.5,
        seed=42
    ):
        """
        Args:
            scene_list: list of tuples (img_path, mask_path, category).
            data_root: directory if scene_list is not provided.
            transform: callable optional augmentation.
            mock_mode: if True, generates synthetic random tensors.
            num_mock_samples: number of synthetic samples if mock_mode=True.
            tile_size: tile dimension (512x512).
            normalize: whether to apply Z-score normalization with train stats.
            augment: whether to apply geometric data augmentation (flips and rotations).
            balance_ratio: ratio of negative tiles to positive tiles (None to keep all).
        """
        self.transform = transform
        self.mock_mode = mock_mode
        self.num_mock_samples = num_mock_samples
        self.tile_size = tile_size
        self.normalize = normalize
        self.augment = augment

        if self.mock_mode:
            print(f"[WARNING] SARDataset initialized in MOCK MODE ({self.num_mock_samples} samples).")
            self.tiles = list(range(self.num_mock_samples))
            return

        if scene_list is None:
            if data_root is None:
                raise ValueError("Must provide either scene_list or data_root.")
            train_scenes, _ = get_scene_splits(data_root=data_root, seed=seed)
            scene_list = train_scenes

        self.scene_list = scene_list
        self.tiles = []
        self._index_tiles(balance_ratio, seed)

    def _index_tiles(self, balance_ratio, seed):
        """
        Indexes 512x512 tile coordinates for each 2048x2048 scene.
        Optionally balances positive and negative tiles.
        """
        pos_tiles = []
        neg_tiles = []

        grid_steps = 2048 // self.tile_size  # 4x4 = 16 tiles per scene

        for img_path, mask_path, category in self.scene_list:
            is_negative_scene = (category in ["Lookalike", "No oil"])
            
            if is_negative_scene:
                for r in range(grid_steps):
                    for c in range(grid_steps):
                        neg_tiles.append((img_path, mask_path, r * self.tile_size, c * self.tile_size, 0))
            else:
                # Oil scene: inspect mask to separate positive vs negative tiles
                try:
                    with rasterio.open(mask_path) as src:
                        for r in range(grid_steps):
                            for c in range(grid_steps):
                                row_off = r * self.tile_size
                                col_off = c * self.tile_size
                                w = Window(col_off, row_off, self.tile_size, self.tile_size)
                                m = src.read(1, window=w)
                                has_oil = int(np.count_nonzero(m == 1) > 0)
                                if has_oil:
                                    pos_tiles.append((img_path, mask_path, row_off, col_off, 1))
                                else:
                                    neg_tiles.append((img_path, mask_path, row_off, col_off, 0))
                except Exception as e:
                    print(f"Error indexing {mask_path}: {e}")

        if balance_ratio is not None and len(pos_tiles) > 0:
            random.seed(seed)
            max_neg = int(len(pos_tiles) * balance_ratio)
            if len(neg_tiles) > max_neg:
                neg_tiles = random.sample(neg_tiles, max_neg)

        self.tiles = pos_tiles + neg_tiles
        random.seed(seed)
        random.shuffle(self.tiles)
        print(f"SARDataset indexed {len(self.tiles)} tiles (Positive: {len(pos_tiles)}, Negative: {len(neg_tiles)}).")

    def __len__(self):
        return len(self.tiles)

    def __getitem__(self, idx):
        if self.mock_mode:
            vv = np.random.normal(-10, 3, (512, 512)).astype(np.float32)
            vh = np.random.normal(-18, 4, (512, 512)).astype(np.float32)
            mask_np = np.zeros((1, 512, 512), dtype=np.float32)
            mask_np[0, 200:300, 200:300] = 1.0
            vv[200:300, 200:300] -= 15.0
            vh[200:300, 200:300] -= 15.0
            return torch.from_numpy(np.stack([vv, vh], axis=0)), torch.from_numpy(mask_np)

        img_path, mask_path, row_off, col_off, _ = self.tiles[idx]
        w = Window(col_off, row_off, self.tile_size, self.tile_size)

        with rasterio.open(img_path) as s_img:
            image_np = s_img.read(window=w).astype(np.float32) # [2, 512, 512]

        with rasterio.open(mask_path) as s_mask:
            mask_np = s_mask.read(window=w).astype(np.float32)   # [1, 512, 512]

        # Handle NaNs or Infs
        np.nan_to_num(image_np, copy=False, nan=-35.0, posinf=0.0, neginf=-50.0)
        np.nan_to_num(mask_np, copy=False, nan=0.0, posinf=0.0, neginf=0.0)

        # Ensure mask is strictly binary [0, 1]
        mask_np = (mask_np > 0.5).astype(np.float32)

        # Normalization (Section 17: Z-score standardization from train stats)
        if self.normalize:
            image_np[0] = (image_np[0] - SAR_TRAIN_MEAN[0]) / SAR_TRAIN_STD[0]
            image_np[1] = (image_np[1] - SAR_TRAIN_MEAN[1]) / SAR_TRAIN_STD[1]
            # Clip extreme values beyond +/- 4 standard deviations
            np.clip(image_np, -4.0, 4.0, out=image_np)

        image_tensor = torch.from_numpy(image_np)
        mask_tensor = torch.from_numpy(mask_np)

        # Geometric Data Augmentation (D4 Dihedral Group: Flips + 90/180/270 rotations)
        if self.augment:
            # 1. Random Horizontal Flip (p=0.5)
            if random.random() > 0.5:
                image_tensor = torch.flip(image_tensor, dims=[-1])
                mask_tensor = torch.flip(mask_tensor, dims=[-1])
            # 2. Random Vertical Flip (p=0.5)
            if random.random() > 0.5:
                image_tensor = torch.flip(image_tensor, dims=[-2])
                mask_tensor = torch.flip(mask_tensor, dims=[-2])
            # 3. Random Orthogonal Rotation (0, 90, 180, 270 degrees)
            k = random.randint(0, 3)
            if k > 0:
                image_tensor = torch.rot90(image_tensor, k=k, dims=[-2, -1])
                mask_tensor = torch.rot90(mask_tensor, k=k, dims=[-2, -1])
            image_tensor = image_tensor.contiguous()
            mask_tensor = mask_tensor.contiguous()

        if self.transform:
            image_tensor, mask_tensor = self.transform(image_tensor, mask_tensor)

        return image_tensor, mask_tensor
