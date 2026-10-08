import os
import argparse
import pandas as pd
import numpy as np

def run_failure_analysis(args):
    print("==================================================")
    print("OILTRACE: FAILURE ANALYSIS REPORT (STEP 34)")
    print("==================================================")
    print("NOTE: This script analyzes the worst-performing scenes from the validation/test set.")
    print("      It must be run AFTER full training on the verified Sentinel-1 dataset.\n")
    
    # Placeholder for reading validation/test results
    if not os.path.exists(args.results_csv):
        print(f"[BLOCKED] Results file {args.results_csv} not found.")
        print("          Please complete full dataset training and evaluation first.")
        return
        
    df = pd.read_csv(args.results_csv)
    
    # 1. Identify worst Dice scores
    worst_dice = df.sort_values('dice_score').head(10)
    
    # 2. Identify Lookalike False Positives (high FPR)
    worst_fp = df.sort_values('false_positive_rate', ascending=False).head(10)
    
    # 3. Identify Missed Spills (high FNR)
    worst_fn = df.sort_values('false_negative_rate', ascending=False).head(10)
    
    print(f"Top 5 Worst Dice Scores (High Error):")
    for _, row in worst_dice.head(5).iterrows():
        print(f"  Scene: {row['scene_id']} - Dice: {row['dice_score']:.4f}")
        
    print(f"\nTop 5 Highest False Positive Rates (Likely Lookalikes):")
    for _, row in worst_fp.head(5).iterrows():
        print(f"  Scene: {row['scene_id']} - FPR: {row['false_positive_rate']:.4f}")

    print("\nAction Required:")
    print("  Visually inspect these specific `.tif` scenes to determine if the errors")
    print("  are caused by wind-shadow lookalikes, biogenic slicks, or boundary effects.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OilTrace Failure Analysis")
    parser.add_argument("--results_csv", type=str, default="model/outputs/test_results.csv")
    args = parser.parse_args()
    
    run_failure_analysis(args)
