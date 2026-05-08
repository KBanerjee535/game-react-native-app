"""
Crop campagne-europe-map.png to create RETOUR FRANCE sectors.
campagne-europe-map.png (1024x1536) covers all of Europe from Scandinavia to North Africa.

Geography analysis of campagne-europe-map.png:
  y ~28-30%: English Channel / Brittany
  y ~30-42%: France mainland
  y ~42-58%: Pyrenees / Northern Spain
  y ~58-68%: Central/Southern Spain
  y ~68-78%: Strait of Gibraltar
  y ~78-95%: North Africa (Morocco, Algeria)

We crop from y=27% to y=97%:
  North sector (TL): France + Northern Spain (top half)
  South sector (BL): Southern Spain + North Africa (bottom half)
"""
from PIL import Image
import numpy as np

src = Image.open('/app/frontend/assets/images/campagne-europe-map.png')
W, H = src.size  # 1024 x 1536

# Crop boundaries
y_top = int(0.27 * H)    # ~415 - start just above France (English Channel visible)
y_bottom = int(0.97 * H) # ~1490 - end well into North Africa

# Make total height even for clean split
total_h = y_bottom - y_top
if total_h % 2 == 1:
    y_bottom -= 1
    total_h -= 1

half_h = total_h // 2
y_mid = y_top + half_h

print(f"Source: {W}x{H}")
print(f"Crop: y={y_top} to y={y_bottom} (total={total_h}px)")
print(f"North: y={y_top} to y={y_mid} ({half_h}px)")
print(f"South: y={y_mid} to y={y_bottom} ({half_h}px)")

# Crop sectors
north_crop = src.crop((0, y_top, W, y_mid))
south_crop = src.crop((0, y_mid, W, y_bottom))

# Target size for each sector: 1024 x 1536 (portrait phone ratio)
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

# Generate 50x50 land masks for each sector
def generate_mask(img, name):
    arr = np.array(img)
    h, w = arr.shape[:2]
    GRID = 50
    ch, cw = h // GRID, w // GRID
    rows = []
    for r in range(GRID):
        s = ""
        for c in range(GRID):
            cell = arr[r*ch:(r+1)*ch, c*cw:(c+1)*cw]
            rm = float(cell[:,:,0].mean())
            gm = float(cell[:,:,1].mean())
            bm = float(cell[:,:,2].mean())
            # Land detection: warm beige tones (R highest, R-B > threshold)
            is_land = (rm - bm > 12) and (rm > 140) and (rm > gm)
            s += "1" if is_land else "0"
        rows.append(s)
    
    land = sum(r.count('1') for r in rows)
    print(f"\n{name}: {land}/2500 ({100*land/2500:.1f}% land)")
    for r in rows:
        print(f'    "{r}",')
    return rows

print("\n=== LAND MASKS ===")
north_mask = generate_mask(north_resized, "retourfrance_north")
south_mask = generate_mask(south_resized, "retourfrance_south")
print("\n=== DONE ===")
