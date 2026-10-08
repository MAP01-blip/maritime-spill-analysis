import sys
import subprocess

def test_evaluation_isolation():
    print("Testing evaluate.py in test mode...")
    # Run test mode
    cmd = ["python", "model/evaluation/evaluate.py", "--mode", "test", "--threshold", "0.5"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    # Check if threshold analysis is in the output
    if "Threshold Analysis:" in result.stdout:
        print("FAIL: Threshold sweep is still running in test mode!")
        sys.exit(1)
        
    if "EXACT-ONCE TEST EVALUATION" not in result.stdout:
        print("FAIL: Test mode output not found!")
        sys.exit(1)
        
    print("PASS: evaluate.py test mode isolates test data from threshold selection.")

if __name__ == "__main__":
    test_evaluation_isolation()
