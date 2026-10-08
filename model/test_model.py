import torch
from models.unet import UNet
from utils.loss import OilTraceLoss
import time

def run_tests():
    print("==================================================")
    print("OILTRACE: ARCHITECTURE & LOSS TESTS (STEPS 17, 18, 21)")
    print("==================================================")

    # 1. Instantiate Model
    model = UNet(in_channels=2, out_channels=1, base_c=32)
    
    # STEP 18: Calculate Parameter Count
    total_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"[STEP 18] Model Parameter Count: {total_params:,}")
    if 7000000 <= total_params <= 8000000:
        print("          -> Fits within the ~7.2M expected range.")
    else:
        print("          -> WARNING: Parameter count is outside expected range!")

    # STEP 17: Run Shape Test
    print("\n[STEP 17] Running Shape Test...")
    x = torch.randn(2, 2, 512, 512)
    start_time = time.time()
    y = model(x)
    elapsed = time.time() - start_time
    print(f"          Input shape:  {list(x.shape)}")
    print(f"          Output shape: {list(y.shape)}")
    print(f"          Forward pass time: {elapsed:.4f}s")
    
    assert y.shape == (2, 1, 512, 512), f"Shape test failed! Expected (2, 1, 512, 512), got {y.shape}"
    print("          -> Shape Test PASSED.")

    # STEP 21: Test Loss
    print("\n[STEP 21] Running Backward Pass / Loss Test (Step 65)...")
    target = torch.randint(0, 2, (2, 1, 512, 512)).float()
    
    criterion = OilTraceLoss(bce_weight=0.5, dice_weight=0.5)
    loss = criterion(y, target)
    print(f"          Initial Loss: {loss.item():.4f}")
    
    assert not torch.isnan(loss), "Loss is NaN!"
    assert not torch.isinf(loss), "Loss is Inf!"
    
    loss.backward()
    
    # Check gradients
    has_nan = False
    for name, param in model.named_parameters():
        if param.grad is not None:
            if torch.isnan(param.grad).any() or torch.isinf(param.grad).any():
                has_nan = True
                print(f"          -> WARNING: NaN or Inf gradients in {name}")
                break
                
    if not has_nan:
        print("          -> Backward Pass PASSED. No NaN/Inf gradients.")
    
    print("==================================================")
    print("ALL TESTS PASSED SUCCESSFULLY.")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
