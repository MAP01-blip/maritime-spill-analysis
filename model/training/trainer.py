import torch
import time
import os

class OilTraceTrainer:
    def __init__(
        self,
        model,
        train_loader,
        val_loader,
        criterion,
        optimizer,
        scheduler,
        metrics,
        device,
        epochs=50,
        patience=10,
        checkpoint_dir="checkpoints"
    ):
        self.model = model
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.criterion = criterion
        self.optimizer = optimizer
        self.scheduler = scheduler
        self.metrics = metrics
        self.device = device
        self.epochs = epochs
        self.patience = patience
        
        self.checkpoint_dir = checkpoint_dir
        os.makedirs(self.checkpoint_dir, exist_ok=True)
        
        self.best_val_dice = -1.0
        self.epochs_without_improvement = 0
        
    def train_epoch(self, epoch):
        self.model.train()
        total_loss = 0.0
        
        start_time = time.time()
        
        for batch_idx, (images, masks) in enumerate(self.train_loader):
            images = images.to(self.device)
            masks = masks.to(self.device)
            
            self.optimizer.zero_grad()
            
            logits = self.model(images)
            loss = self.criterion(logits, masks)
            
            loss.backward()
            
            # Optional gradient clipping could go here if exploding gradients occur (Section 46)
            
            self.optimizer.step()
            
            total_loss += loss.item()
            
        elapsed = time.time() - start_time
        avg_loss = total_loss / len(self.train_loader)
        
        print(f"Epoch [{epoch}/{self.epochs}] - Train Loss: {avg_loss:.4f} - Time: {elapsed:.2f}s")
        return avg_loss

    @torch.no_grad()
    def validate_epoch(self, epoch):
        self.model.eval()
        total_loss = 0.0
        self.metrics.reset()
        
        for images, masks in self.val_loader:
            images = images.to(self.device)
            masks = masks.to(self.device)
            
            logits = self.model(images)
            loss = self.criterion(logits, masks)
            
            total_loss += loss.item()
            self.metrics.update(logits, masks)
            
        avg_loss = total_loss / len(self.val_loader)
        res = self.metrics.compute()
        
        print(f"Validation - Loss: {avg_loss:.4f} - Dice: {res['dice']:.4f} - IoU: {res['iou']:.4f}")
        return avg_loss, res['dice']

    def train(self):
        print(f"Starting training on {self.device} for {self.epochs} epochs...")
        for epoch in range(1, self.epochs + 1):
            train_loss = self.train_epoch(epoch)
            val_loss, val_dice = self.validate_epoch(epoch)
            
            # Scheduler Step (Section 42: monitor validation loss)
            if self.scheduler is not None:
                self.scheduler.step(val_loss)
                
            # Checkpoint saving (Section 41 & 79: monitor validation Dice)
            if val_dice > self.best_val_dice:
                print(f"Validation Dice improved from {self.best_val_dice:.4f} to {val_dice:.4f}. Saving best checkpoint.")
                self.best_val_dice = val_dice
                self.epochs_without_improvement = 0
                
                checkpoint_path = os.path.join(self.checkpoint_dir, "unet__baseline_v1__best.pt")
                torch.save(self.model.state_dict(), checkpoint_path)
            else:
                self.epochs_without_improvement += 1
                print(f"Validation Dice did not improve. Early stopping counter: {self.epochs_without_improvement}/{self.patience}")
                
            # Save the last checkpoint as well (Section 79)
            last_path = os.path.join(self.checkpoint_dir, "unet__baseline_v1__last.pt")
            torch.save(self.model.state_dict(), last_path)
                
            # Early stopping check (Section 41)
            if self.epochs_without_improvement >= self.patience:
                print(f"Early stopping triggered after {epoch} epochs!")
                break
                
        print(f"Training Complete. Best Validation Dice: {self.best_val_dice:.4f}")
