"""Generate land masks for all mission maps."""
from PIL import Image
import numpy as np

MAPS = [
    ("gibraltar-map.png", "gibraltar"),
    ("mauritanie-map.png", "mauritanie"),
    ("atlantique-map.png", "atlantique"),
    ("amazonie-map.png", "amazonie"),
    ("buenosaires-map.png", "buenos_aires"),
    ("patagonie.png", "patagonie"),
    ("paraguay-map.png", "paraguay"),
    ("africa-again-map.png", "africa_again"),
    ("sahel-map.png", "sahel"),
]

all_masks = {}

for filename, key in MAPS:
    path = f"/app/frontend/assets/images/{filename}"
    img = Image.open(path)
    if img.mode == 'RGBA':
        img = img.convert('RGB')
    arr = np.array(img)
    h, w = arr.shape[:2]
    r, g, b = arr[:,:,0].astype(float), arr[:,:,1].astype(float), arr[:,:,2].astype(float)
    diff = r - b
    
    # Auto-detect best threshold
    best_thresh = 30  # default
    for thresh in [25, 30, 35, 40, 50]:
        land_pct = (diff > thresh).mean() * 100
        if land_pct < 90:
            best_thresh = thresh
            break
    
    land_mask = diff > best_thresh
    GRID = 50
    
    rows = []
    land_count = 0
    for gy in range(GRID):
        row = ''
        for gx in range(GRID):
            y1 = int(gy * h / GRID)
            y2 = int((gy + 1) * h / GRID)
            x1 = int(gx * w / GRID)
            x2 = int((gx + 1) * w / GRID)
            pct = land_mask[y1:y2, x1:x2].mean()
            is_land = pct > 0.55
            row += '1' if is_land else '0'
            if is_land: land_count += 1
        rows.append(row)
    
    sea_pct = (GRID*GRID - land_count) / (GRID*GRID) * 100
    print(f"{key} ({filename}): {w}x{h}, thresh={best_thresh}, sea={sea_pct:.0f}%")
    all_masks[key] = rows

# Output as TypeScript
print("\n// ─── MASQUES TERRE/MER UNIFIÉS ─────────────────────────────────────")
print("const LAND_MASKS: Record<string, string[]> = {")
for key, rows in all_masks.items():
    print(f"  {key}: [")
    for row in rows:
        print(f'    "{row}",')
    print("  ],")
print("};")
print()
print("const isOnLandByMask = (maskId: string, x: number, y: number): boolean => {")
print("  const mask = LAND_MASKS[maskId];")
print("  if (!mask) return true; // No mask = allow all")
print("  const gridSize = mask.length;")
print("  const gx = Math.min(Math.floor(x * gridSize), gridSize - 1);")
print("  const gy = Math.min(Math.floor(y * gridSize), gridSize - 1);")
print("  if (gy < 0 || gy >= gridSize || gx < 0 || gx >= gridSize) return false;")
print("  return mask[gy][gx] === '1';")
print("};")
