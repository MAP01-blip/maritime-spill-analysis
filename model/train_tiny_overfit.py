import torch
import torch.optim as optim
from torch.utils.data import DataLoader
from models.unet import UNet
from data.dataset import SARDataset
from utils.loss import OilTraceLoss
from utils.metrics import SegmentationMetrics
import time

def run_tiny_overfit():
    print("==================================================")
    print("OILTRACE: TINY OVERFIT TEST (REQUIRED GATE)")
    print("==================================================")
    
    # Device configuration
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Using device: {device}")
    
    # 1. Instantiate Model
    model = UNet(in_channels=2, out_channels=1, base_c=32).to(device)
    
    # 2. Instantiate Mock Dataset (1 batch of 4 samples)
    dataset = SARDataset(images_dir="", masks_dir="", mock_mode=True, num_mock_samples=4)
    dataloader = DataLoader(dataset, batch_size=4, shuffle=True)
    
    # 3. Loss & Optimizer (AdamW, lr=1e-4)
    criterion = OilTraceLoss(bce_weight=0.5, dice_weight=0.5)
    optimizer = optim.AdamW(model.parameters(), lr=5e-3) # Higher LR for quick overfit
    
    # 4. Metrics
    metrics = SegmentationMetrics(threshold=0.5)
    
    epochs = 60
    print(f"Training on 1 batch for {epochs} epochs to verify capacity to overfit...")
    
    # Grab the single batch and reuse it to force overfitting
    data_iter = iter(dataloader)
    images, masks = next(data_iter)
    images = images.to(device)
    masks = masks.to(device)
    
    model.train()
    
    for epoch in range(1, epochs + 1):
        start_time = time.time()
        
        optimizer.zero_grad()
        
        # Forward pass
        logits = model(images)
        loss = criterion(logits, masks)
        
        # Backward pass
        loss.backward()
        optimizer.step()
        
        # Update metrics
        metrics.reset()
        metrics.update(logits.detach(), masks)
        res = metrics.compute()
        
        elapsed = time.time() - start_time
        
        print(f"Epoch {epoch:03d}/{epochs} | Loss: {loss.item():.4f} | Dice: {res['dice']:.4f} | IoU: {res['iou']:.4f} | Time: {elapsed:.2f}s")
        
    print("==================================================")
    if loss.item() < 0.1 and res['dice'] > 0.9:
        print("[SUCCESS] Tiny Overfit Test PASSED. Model is capable of learning.")
    else:
        print("[WARNING] Tiny Overfit Test did NOT converge well. Check architecture or loss.")
    print("==================================================")

if __name__ == "__main__":
    run_tiny_overfit()
