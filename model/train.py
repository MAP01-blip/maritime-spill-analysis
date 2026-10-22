import torch
import torch.optim as optim
from torch.optim.lr_scheduler import ReduceLROnPlateau
from torch.utils.data import DataLoader
import os
import argparse

from models.unet import UNet
from data.dataset import SARDataset, get_scene_splits
from utils.loss import OilTraceLoss
from utils.metrics import SegmentationMetrics
from training.trainer import OilTraceTrainer

def main(args):
    print("==================================================")
    print("OILTRACE: REAL RADAR TRAINING PIPELINE (STEPS 23-27)")
    print("==================================================")
    
    # 43. Random Seed
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)
    
    # 44. Device Selection
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Device Selected: {device}")
    
    # Model Architecture
    model = UNet(in_channels=2, out_channels=1, base_c=32).to(device)
    if args.resume and os.path.exists(args.resume):
        print(f"Loading existing checkpoint to resume training: {args.resume}")
        model.load_state_dict(torch.load(args.resume, map_location=device))
    
    # Datasets
    if args.mock_mode:
        print("[MODE] Running in synthetic MOCK mode.")
        train_dataset = SARDataset(mock_mode=True, num_mock_samples=64)
        val_dataset = SARDataset(mock_mode=True, num_mock_samples=16)
    else:
        print(f"[MODE] Loading Real Sentinel-1 SAR Dataset from: {args.data_root}")
        train_scenes, val_scenes = get_scene_splits(
            data_root=args.data_root,
            train_ratio=args.train_ratio,
            seed=args.seed
        )
        print(f"Scene Split: {len(train_scenes)} Train Scenes | {len(val_scenes)} Val Scenes")
        
        train_dataset = SARDataset(
            scene_list=train_scenes,
            balance_ratio=args.balance_ratio,
            augment=args.augment,
            seed=args.seed
        )
        val_dataset = SARDataset(
            scene_list=val_scenes,
            balance_ratio=args.balance_ratio,
            augment=False,
            seed=args.seed
        )
    
    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.num_workers
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers
    )
    
    # Loss: 0.5 * BCEWithLogits + 0.5 * Dice
    criterion = OilTraceLoss(bce_weight=0.5, dice_weight=0.5)
    
    # Optimizer (Section 39: AdamW, lr=1e-4, wd=1e-4)
    optimizer = optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    
    # Scheduler (Section 42: ReduceLROnPlateau, factor=0.5, patience=3)
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
    
    if args.resume and os.path.exists(args.resume):
        print("\n[RESUME] Evaluating checkpoint to establish baseline metric...")
        _, initial_dice = trainer.validate_epoch(epoch=0)
        trainer.best_val_dice = initial_dice
        print(f"[RESUME] Checkpoint initial validation Dice: {initial_dice:.4f}\n")
    
    # STEP 24 & 25: Train baseline & Validate
    trainer.train()
    
    # STEP 27: Test Checkpoint Loading
    print("\n[STEP 27] Verifying Checkpoint Loading...")
    test_model = UNet(in_channels=2, out_channels=1, base_c=32)
    checkpoint_path = os.path.join(checkpoint_dir, "unet__baseline_v1__best.pt")
    
    if os.path.exists(checkpoint_path):
        test_model.load_state_dict(torch.load(checkpoint_path, map_location="cpu"))
        print(f"-> Checkpoint successfully verified and loaded from {checkpoint_path}")
    else:
        print(f"-> ERROR: Checkpoint file {checkpoint_path} not found!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OilTrace U-Net Training on Real Sentinel-1 SAR Data")
    parser.add_argument("--data_root", type=str, default="/Users/kingu/11/02_Test_images_and_ground_truth", help="Path to real SAR dataset")
    parser.add_argument("--resume", type=str, default="", help="Path to checkpoint to resume training from")
    parser.add_argument("--train_ratio", type=float, default=0.8, help="Train/val split ratio (Section 16)")
    parser.add_argument("--balance_ratio", type=float, default=1.0, help="Ratio of negative to positive tiles for balanced training")
    parser.add_argument("--batch_size", type=int, default=4, help="Batch size (Section 40)")
    parser.add_argument("--epochs", type=int, default=10, help="Max epochs (Section 41)")
    parser.add_argument("--patience", type=int, default=4, help="Early stopping patience")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate (Section 39)")
    parser.add_argument("--weight_decay", type=float, default=1e-4, help="Weight decay")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (Section 43)")
    parser.add_argument("--num_workers", type=int, default=0, help="DataLoader workers")
    parser.add_argument("--mock_mode", action="store_true", default=False, help="Use mock dataset")
    parser.add_argument("--augment", action="store_true", default=True, help="Enable random flips and rotations for training")
    parser.add_argument("--no_augment", dest="augment", action="store_false", help="Disable data augmentation")
    
    args = parser.parse_args()
    main(args)
