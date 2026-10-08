import torch
import torch.nn as nn
import torch.nn.functional as F

class DoubleConv(nn.Module):
    """
    Double Convolution Block: (Conv2d -> GroupNorm -> ReLU) * 2
    Uses GroupNorm(groups=8) as specified to handle small batch sizes better than BatchNorm.
    """
    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.double_conv = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(8, out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(8, out_channels),
            nn.ReLU(inplace=True)
        )

    def forward(self, x):
        return self.double_conv(x)

class DownBlock(nn.Module):
    """
    Downscaling with maxpool then double conv
    """
    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.maxpool_conv = nn.Sequential(
            nn.MaxPool2d(2),
            DoubleConv(in_channels, out_channels)
        )

    def forward(self, x):
        return self.maxpool_conv(x)

class UpBlock(nn.Module):
    """
    Upscaling using Bilinear Interpolation followed by a 1x1 Conv,
    then concatenation with skip connection, then double conv.
    """
    def __init__(self, in_channels, out_channels):
        super().__init__()
        # Bilinear interpolation + 1x1 convolution
        self.up = nn.Sequential(
            nn.Upsample(scale_factor=2, mode='bilinear', align_corners=True),
            nn.Conv2d(in_channels, in_channels // 2, kernel_size=1, bias=False)
        )
        self.conv = DoubleConv(in_channels, out_channels)

    def forward(self, x1, x2):
        x1 = self.up(x1)
        # Pad if dimensions don't match perfectly (for safety, though inputs should be 512x512)
        diffY = x2.size()[2] - x1.size()[2]
        diffX = x2.size()[3] - x1.size()[3]
        
        if diffY > 0 or diffX > 0:
            x1 = F.pad(x1, [diffX // 2, diffX - diffX // 2,
                            diffY // 2, diffY - diffY // 2])
                            
        # Skip connection concatenation
        x = torch.cat([x2, x1], dim=1)
        return self.conv(x)

class UNet(nn.Module):
    """
    OilTrace SAR U-Net for Marine Oil-Spill Detection
    Input: [Batch, 2 (VV, VH), 512, 512]
    Output: [Batch, 1 (Logits), 512, 512]
    Channels: 32 -> 64 -> 128 -> 256 -> 512 (Bottleneck)
    """
    def __init__(self, in_channels=2, out_channels=1, base_c=32):
        super().__init__()
        self.in_channels = in_channels
        self.out_channels = out_channels
        
        # Encoder (Downsampling)
        self.inc = DoubleConv(in_channels, base_c)               # 512x512, 32 channels
        self.down1 = DownBlock(base_c, base_c * 2)               # 256x256, 64 channels
        self.down2 = DownBlock(base_c * 2, base_c * 4)           # 128x128, 128 channels
        self.down3 = DownBlock(base_c * 4, base_c * 8)           # 64x64, 256 channels
        
        # Bottleneck
        self.down4 = DownBlock(base_c * 8, base_c * 16)          # 32x32, 512 channels
        
        # Decoder (Upsampling with skip connections)
        self.up1 = UpBlock(base_c * 16, base_c * 8)              # 64x64, 256 channels
        self.up2 = UpBlock(base_c * 8, base_c * 4)               # 128x128, 128 channels
        self.up3 = UpBlock(base_c * 4, base_c * 2)               # 256x256, 64 channels
        self.up4 = UpBlock(base_c * 2, base_c)                   # 512x512, 32 channels
        
        # Output Logits
        self.outc = nn.Conv2d(base_c, out_channels, kernel_size=1) # 512x512, 1 channel

    def forward(self, x):
        # Encoder Path
        x1 = self.inc(x)
        x2 = self.down1(x1)
        x3 = self.down2(x2)
        x4 = self.down3(x3)
        x5 = self.down4(x4) # Bottleneck
        
        # Decoder Path
        x = self.up1(x5, x4)
        x = self.up2(x, x3)
        x = self.up3(x, x2)
        x = self.up4(x, x1)
        
        logits = self.outc(x)
        return logits
