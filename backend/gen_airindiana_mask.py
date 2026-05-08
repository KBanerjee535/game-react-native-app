"""Generate land mask for AIR INDIANA Indian Ocean map (50x50)."""
from PIL import Image
import numpy as np

img = Image.open("/app/frontend/assets/images/airindiana-map.png").convert('RGB')
arr = np.array(img)
h, w = arr.shape[:2]
r = arr[:,:,0].astype(float)
g = arr[:,:,1].astype(float)
b = arr[:,:,2].astype(float)
land_mask = (r - g > 25) & (r > 140)
print(f"Land pct: {land_mask.mean()*100:.1f}%")

GRID = 50
grid = np.zeros((GRID, GRID), dtype=int)
for gy in range(GRID):
    for gx in range(GRID):
        y1 = int(gy * h / GRID); y2 = int((gy + 1) * h / GRID)
        x1 = int(gx * w / GRID); x2 = int((gx + 1) * w / GRID)
        pct = land_mask[y1:y2, x1:x2].mean()
        grid[gy, gx] = 1 if pct > 0.55 else 0

print("const AIRINDIANA_LAND_MASK: string[] = [")
for gy in range(GRID):
    row = "".join("1" if grid[gy, gx] else "0" for gx in range(GRID))
    print(f'  "{row}",')
print("];")
