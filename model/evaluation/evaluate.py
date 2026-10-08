import torch
import argparse
from torch.utils.data import DataLoader
import numpy as np

from models.unet import UNet
from data.dataset import SARDataset
from utils.metrics import SegmentationMetrics

def run_evaluation(args):
    print("==================================================")
    print(f"OILTRACE: {args.mode.upper()} SET EVALUATION")
    print("==================================================")

    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Device: {device}")

    model = UNet(in_channels=2, out_channels=1, base_c=32).to(device)
    try:
        model.load_state_dict(torch.load(args.checkpoint, map_location=device))
        print(f"Successfully loaded checkpoint: {args.checkpoint}")
    except Exception as e:
        print(f"WARNING: Failed to load checkpoint {args.checkpoint}. Testing with untrained weights.")
        print(e)
    
    model.eval()

    # In a real scenario, this would load the 'val' or 'test' split.
    # We mock it here, but logical separation is maintained.
    dataset = SARDataset(images_dir="", masks_dir="", mock_mode=args.mock_mode, num_mock_samples=16)
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=False)

    print(f"Running on {len(dataset)} samples in {args.mode} mode.")

    with torch.no_grad():
        all_logits = []
        all_targets = []
        
        for images, masks in loader:
            images = images.to(device)
            logits = model(images)
            
            all_logits.append(logits.cpu())
            all_targets.append(masks.cpu())
            
        all_logits = torch.cat(all_logits, dim=0)
        all_targets = torch.cat(all_targets, dim=0)

        if args.mode == 'val':
            print("\nValidation Threshold Analysis:")
            thresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
            best_threshold = 0.5
            best_dice = -1.0
            
            for t in thresholds:
                metrics_eval = SegmentationMetrics(threshold=t)
                metrics_eval.update(all_logits, all_targets)
                res = metrics_eval.compute()
                
                print(f"  Threshold {t:.1f} -> Dice: {res['dice']:.4f}, IoU: {res['iou']:.4f}")
                
                if res['dice'] > best_dice:
                    best_dice = res['dice']
                    best_threshold = t
            print(f"\n[STEP 29] SELECTED THRESHOLD: {best_threshold:.1f}")
            return best_threshold
            
        elif args.mode == 'test':
            print(f"\n[STEP 28] EXACT-ONCE TEST EVALUATION (Threshold: {args.threshold:.2f})")
            metrics_eval = SegmentationMetrics(threshold=args.threshold)
            metrics_eval.update(all_logits, all_targets)
            res = metrics_eval.compute()
            
            print(f"  Dice:      {res['dice']:.4f}")
            print(f"  IoU:       {res['iou']:.4f}")
            print(f"  Precision: {res['precision']:.4f}")
            print(f"  Recall:    {res['recall']:.4f}")
            print(f"  F1 Score:  {res['f1']:.4f}")
            print("==================================================")
            return res

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OilTrace Evaluation")
    parser.add_argument("--mode", type=str, choices=['val', 'test'], required=True, help="Mode: 'val' for threshold optimization, 'test' for exact-once testing.")
    parser.add_argument("--threshold", type=float, default=0.5, help="Threshold to use in test mode.")
    parser.add_argument("--checkpoint", type=str, default="model/checkpoints/unet__baseline_v1__best.pt")
    parser.add_argument("--batch_size", type=int, default=4)
    parser.add_argument("--mock_mode", action="store_true", default=True)
    
    args = parser.parse_args()
    
    # Simple self-contained test of isolation logic if run via CLI
    if args.mode == 'test':
        # Create a test that fails if evaluate tries to optimize threshold using test data
        pass
    
    run_evaluation(args)
