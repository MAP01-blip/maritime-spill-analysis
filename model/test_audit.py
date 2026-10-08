import torch
import torch.nn as nn
from models.unet import UNet
from utils.loss import OilTraceLoss, DiceLoss

def test_unet():
    print("Testing UNet...")
    model = UNet()
    
    # Batch size 1
    x1 = torch.randn(1, 2, 512, 512)
    y1 = model(x1)
    assert y1.shape == (1, 1, 512, 512)
    
    # Batch size 2
    x2 = torch.randn(2, 2, 512, 512)
    y2 = model(x2)
    assert y2.shape == (2, 1, 512, 512)
    
    # Backward pass
    loss = y2.sum()
    loss.backward()
    
    for name, param in model.named_parameters():
        assert param.grad is not None
        assert torch.isfinite(param.grad).all()
        
    print("UNet tests passed.")

def test_loss():
    print("Testing Loss...")
    dice = DiceLoss()
    
    # 1. Normal mask
    logits = torch.randn(2, 1, 512, 512)
    targets = torch.randint(0, 2, (2, 1, 512, 512)).float()
    loss1 = dice(logits, targets)
    assert torch.isfinite(loss1)
    
    # 2. Empty target
    targets_empty = torch.zeros((2, 1, 512, 512))
    loss2 = dice(logits, targets_empty)
    assert torch.isfinite(loss2)
    
    # 3. Empty prediction (very negative logits -> sigmoid ~ 0)
    logits_empty = torch.full((2, 1, 512, 512), -100.0)
    loss3 = dice(logits_empty, targets)
    assert torch.isfinite(loss3)
    
    # 4. Both empty
    loss4 = dice(logits_empty, targets_empty)
    assert torch.isfinite(loss4)
    assert loss4 < 0.1 # Should be close to 0
    
    # 5. Completely incorrect prediction (predict 1 where target 0, 0 where 1)
    logits_incorrect = torch.where(targets == 1, torch.tensor(-100.0), torch.tensor(100.0))
    loss5 = dice(logits_incorrect, targets)
    assert torch.isfinite(loss5)
    assert loss5 > 0.9 # Should be close to 1
    
    # 6. Perfect prediction
    logits_perfect = torch.where(targets == 1, torch.tensor(100.0), torch.tensor(-100.0))
    loss6 = dice(logits_perfect, targets)
    assert torch.isfinite(loss6)
    assert loss6 < 0.1 # Should be close to 0

    print("Loss tests passed.")

if __name__ == "__main__":
    test_unet()
    test_loss()
