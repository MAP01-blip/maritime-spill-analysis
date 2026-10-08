import torch
import torch.nn as nn
import torch.nn.functional as F

class DiceLoss(nn.Module):
    """
    Dice Loss for binary segmentation.
    Expects logits as input and applies sigmoid internally.
    """
    def __init__(self, smooth=1e-6):
        super().__init__()
        self.smooth = smooth

    def forward(self, logits, targets):
        probs = torch.sigmoid(logits)
        
        # Flatten predictions and targets
        probs = probs.view(-1)
        targets = targets.view(-1)
        
        intersection = (probs * targets).sum()
        dice = (2. * intersection + self.smooth) / (probs.sum() + targets.sum() + self.smooth)
        
        return 1 - dice

class OilTraceLoss(nn.Module):
    """
    Combined Loss for OilTrace: 0.5 * BCEWithLogits + 0.5 * Dice
    As specified in Section 24 of the Implementation Prompt.
    """
    def __init__(self, bce_weight=0.5, dice_weight=0.5):
        super().__init__()
        self.bce = nn.BCEWithLogitsLoss()
        self.dice = DiceLoss(smooth=1e-6)
        self.bce_weight = bce_weight
        self.dice_weight = dice_weight

    def forward(self, logits, targets):
        bce_loss = self.bce(logits, targets)
        dice_loss = self.dice(logits, targets)
        
        return self.bce_weight * bce_loss + self.dice_weight * dice_loss
