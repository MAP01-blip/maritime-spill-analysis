import json
import os
import argparse
from glob import glob

def run_experiment_comparison(args):
    print("==================================================")
    print("OILTRACE: EXPERIMENT COMPARISON (STEP 35)")
    print("==================================================")
    print("NOTE: This script compares metrics across multiple model versions.")
    print("      (e.g., Baseline U-Net vs. Attention U-Net vs. ResNet Encoder)\n")
    
    experiment_files = glob(os.path.join(args.experiments_dir, "*.json"))
    
    if not experiment_files:
        print(f"[BLOCKED] No experiment logs found in {args.experiments_dir}")
        print("          Complete multiple training runs to compare models.")
        return
        
    results = []
    for filepath in experiment_files:
        with open(filepath, 'r') as f:
            data = json.load(f)
            results.append(data)
            
    # Sort by Dice score descending
    results.sort(key=lambda x: x.get('test_dice', 0.0), reverse=True)
    
    print(f"{'Model Version':<25} | {'Test Dice':<10} | {'Test IoU':<10} | {'Params (M)':<10}")
    print("-" * 65)
    
    for res in results:
        v = res.get('version', 'unknown')
        d = res.get('test_dice', 0.0)
        i = res.get('test_iou', 0.0)
        p = res.get('params_millions', 0.0)
        print(f"{v:<25} | {d:<10.4f} | {i:<10.4f} | {p:<10.2f}")
        
    print("-" * 65)
    print(f"-> BEST MODEL: {results[0].get('version')} (Dice: {results[0].get('test_dice', 0.0):.4f})")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OilTrace Experiment Comparison")
    parser.add_argument("--experiments_dir", type=str, default="model/outputs/experiments")
    args = parser.parse_args()
    
    run_experiment_comparison(args)
