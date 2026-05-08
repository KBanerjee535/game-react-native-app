"""
Crop campagne-europe-map.png to create RETOUR FRANCE sectors.
CRITICAL: Crop BOTH horizontally and vertically to isolate ONLY France, Spain, North Africa.

Source: campagne-europe-map.png (1024x1536)
Geography:
  - France is at x~25-50%, y~30-42%  
  - Spain is at x~10-50%, y~42-68%
  - North Africa is at x~0-50%, y~78-97%
  - Italy/Balkans/Turkey are at x~50-100% → EXCLUDE

Crop: x=0% to 58%, y=27% to 97% → focus on France/Spain/North Africa only.
"""
from PIL import Image
import numpy as np

src = Image.open('/app/frontend/assets/images/campagne-europe-map.png')
W, H = src.size  # 1024 x 1536

# Crop boundaries - BOTH horizontal AND vertical
x_left = 0
x_right = int(0.58 * W)   # ~594px - cut off before Italy
y_top = int(0.27 * H)      # ~415
y_bottom = int(0.97 * H)   # ~1490

# Make total height even for clean split
crop_w = x_right - x_left
crop_h = y_bottom - y_top
if crop_h % 2 == 1:
    y_bottom -= 1
    crop_h -= 1

half_h = crop_h // 2
y_mid = y_top + half_h

print(f"Source: {W}x{H}")
print(f"Crop: x=[{x_left},{x_right}] ({crop_w}px), y=[{y_top},{y_bottom}] ({crop_h}px)")
print(f"North sector: y={y_top} to y={y_mid} ({half_h}px)")
print(f"South sector: y={y_mid} to y={y_bottom} ({half_h}px)")

# Crop sectors
north_crop = src.crop((x_left, y_top, x_right, y_mid))
south_crop = src.crop((x_left, y_mid, x_right, y_bottom))

print(f"North crop size: {north_crop.size}")
print(f"South crop size: {south_crop.size}")

# Target size: 1024 x 1536 per sector (portrait phone ratio)
TARGET_W, TARGET_H = 1024, 1536

north_resized = north_crop.resize((TARGET_W, TARGET_H), Image.LANCZOS)
south_resized = south_crop.resize((TARGET_W, TARGET_H), Image.LANCZOS)

# Save individual sectors
north_resized.save('/app/frontend/assets/images/retourfrance-map-north.png')
south_resized.save('/app/frontend/assets/images/retourfrance-map-south.png')
print(f"\nSaved north: {north_resized.size}")
print(f"Saved south: {south_resized.size}")

# Create combined image (north on top, south on bottom)
composite = Image.new('RGB', (TARGET_W, TARGET_H * 2))
composite.paste(north_resized, (0, 0))
composite.paste(south_resized, (0, TARGET_H))
composite.save('/app/frontend/assets/images/retourfrance-map.png')
print(f"Saved composite: {composite.size}")

print("\n=== Done! ===")
print(f"The crop focuses on x=0-58% (cutting off Italy/Balkans/Turkey)")
print(f"North sector: France + northern Spain")
print(f"South sector: southern Spain + Strait of Gibraltar + North Africa")
