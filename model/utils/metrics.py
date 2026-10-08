import torch

class SegmentationMetrics:
    """
    Computes required metrics for OilTrace:
    Dice, IoU, Precision, Recall, F1
    """
    def __init__(self, threshold=0.5, smooth=1e-6):
        self.threshold = threshold
        self.smooth = smooth
        self.reset()

    def reset(self):
        self.tp = 0.0
        self.fp = 0.0
        self.tn = 0.0
        self.fn = 0.0

    def update(self, logits, targets):
        probs = torch.sigmoid(logits)
        preds = (probs > self.threshold).float()
        
        preds_flat = preds.view(-1)
        targets_flat = targets.view(-1)
        
        # Calculate confusion matrix elements
        self.tp += (preds_flat * targets_flat).sum().item()
        self.fp += (preds_flat * (1 - targets_flat)).sum().item()
        self.fn += ((1 - preds_flat) * targets_flat).sum().item()
        self.tn += ((1 - preds_flat) * (1 - targets_flat)).sum().item()

    def compute(self):
        precision = (self.tp + self.smooth) / (self.tp + self.fp + self.smooth)
        recall = (self.tp + self.smooth) / (self.tp + self.fn + self.smooth)
        f1 = 2 * (precision * recall) / (precision + recall + self.smooth)
        
        iou = (self.tp + self.smooth) / (self.tp + self.fp + self.fn + self.smooth)
        dice = (2 * self.tp + self.smooth) / (2 * self.tp + self.fp + self.fn + self.smooth)
        
        return {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "iou": iou,
            "dice": dice,
            "tp": self.tp,
            "fp": self.fp,
            "fn": self.fn,
            "tn": self.tn
        }
