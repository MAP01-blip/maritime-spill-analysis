import torch
import torch.optim as optim
from torch.optim.lr_scheduler import ReduceLROnPlateau
from torch.utils.data import DataLoader
import os
import argparse

from models.unet import UNet
from data.dataset import SARDataset
from utils.loss import OilTraceLoss
from utils.metrics import SegmentationMetrics
from training.trainer import OilTraceTrainer

def main(args):
    print("==================================================")
    print("OILTRACE: FULL BASELINE TRAINING PIPELINE (STEPS 23-27)")
    print("==================================================")
    
    # 43. Random Seed
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)
    
    # 44. Device Selection
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Device Selected: {device}")
    
    # Model
    model = UNet(in_channels=2, out_channels=1, base_c=32).to(device)
    
    # Datasets
    # 38/39/40: Batch Size 4, Mock mode enabled by default until dataset is fixed
    train_dataset = SARDataset(images_dir="", masks_dir="", mock_mode=args.mock_mode, num_mock_samples=64)
    val_dataset = SARDataset(images_dir="", masks_dir="", mock_mode=args.mock_mode, num_mock_samples=16)
    
    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False)
    
    # Loss
    criterion = OilTraceLoss(bce_weight=0.5, dice_weight=0.5)
    
    # Optimizer (39: AdamW, lr=1e-4, wd=1e-4)
    optimizer = optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    
    # Scheduler (42: ReduceLROnPlateau, factor=0.5, patience=3)
    scheduler = ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=3)
    
    # Metrics
    metrics = SegmentationMetrics(threshold=0.5)
    
    # Trainer
    checkpoint_dir = os.path.join("model", "checkpoints")
    trainer = OilTraceTrainer(
        model=model,
        train_loader=train_loader,
        val_loader=val_loader,
        criterion=criterion,
        optimizer=optimizer,
        scheduler=scheduler,
        metrics=metrics,
        device=device,
        epochs=args.epochs,
        patience=args.patience,
        checkpoint_dir=checkpoint_dir
    )
    
    # STEP 24 & 25: Train baseline & Validate
    trainer.train()
    
    # STEP 27: Test Checkpoint Loading
    print("\n[STEP 27] Verifying Checkpoint Loading...")
    test_model = UNet(in_channels=2, out_channels=1, base_c=32)
    checkpoint_path = os.path.join(checkpoint_dir, "unet__baseline_v1__best.pt")
    
    if os.path.exists(checkpoint_path):
        test_model.load_state_dict(torch.load(checkpoint_path, map_location="cpu"))
        print(f"-> Checkpoint successfully loaded from {checkpoint_path}")
    else:
        print(f"-> ERROR: Checkpoint file {checkpoint_path} not found!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OilTrace U-Net Baseline Training")
    parser.add_argument("--batch_size", type=int, default=4, help="Batch size (Section 40)")
    parser.add_argument("--epochs", type=int, default=50, help="Max epochs (Section 41)")
    parser.add_argument("--patience", type=int, default=10, help="Early stopping patience")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate (Section 39)")
    parser.add_argument("--weight_decay", type=float, default=1e-4, help="Weight decay")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (Section 43)")
    parser.add_argument("--mock_mode", action="store_true", default=True, help="Use mock dataset")
    
    args = parser.parse_args()
    main(args)
