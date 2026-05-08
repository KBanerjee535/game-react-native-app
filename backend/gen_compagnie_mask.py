"""Generate land mask for COMPAGNIE Atlantic map (50x50, with coast detection)."""
from PIL import Image
import numpy as np

img = Image.open("/app/frontend/assets/images/compagnie-map.png").convert('RGB')
arr = np.array(img)
h, w = arr.shape[:2]
print(f"Size: {w}x{h}")

r = arr[:,:,0].astype(float)
g = arr[:,:,1].astype(float)
b = arr[:,:,2].astype(float)

# Land = bright AND yellowish (R > B + delta)
land_mask = (r - b > 50) & (r > 160)
print(f"Land pixels: {land_mask.sum()} / {h*w} = {land_mask.mean()*100:.1f}%")

GRID = 50
grid = np.zeros((GRID, GRID), dtype=int)
for gy in range(GRID):
    for gx in range(GRID):
        y1 = int(gy * h / GRID)
        y2 = int((gy + 1) * h / GRID)
        x1 = int(gx * w / GRID)
        x2 = int((gx + 1) * w / GRID)
        pct = land_mask[y1:y2, x1:x2].mean()
        grid[gy, gx] = 1 if pct > 0.5 else 0

# Print visual
print("\n=== COMPAGNIE LAND MASK ===")
for gy in range(GRID):
    row = ""
    for gx in range(GRID):
        row += "█" if grid[gy, gx] else "·"
    print(f"{row}  y={gy/50:.2f}")

# Generate coast mask: cells that are sea adjacent to land (within distance 1)
print("\n=== COAST MASK (sea cells adjacent to land) ===")
coast = np.zeros((GRID, GRID), dtype=int)
for gy in range(GRID):
    for gx in range(GRID):
        if grid[gy, gx] == 1:  # is land
            continue
        # check 8 neighbours for land
        for dy in [-1, 0, 1]:
            for dx in [-1, 0, 1]:
                ny, nx = gy + dy, gx + dx
                if 0 <= ny < GRID and 0 <= nx < GRID and grid[ny, nx] == 1:
                    coast[gy, gx] = 1
                    break
            if coast[gy, gx]:
                break
for gy in range(GRID):
    row = ""
    for gx in range(GRID):
        if grid[gy, gx]:
            row += "·"
        elif coast[gy, gx]:
            row += "C"
        else:
            row += " "
    print(f"{row}")

print("\n// === COMPAGNIE LAND MASK ===")
print("const COMPAGNIE_LAND_MASK: string[] = [")
for gy in range(GRID):
    row = ""
    for gx in range(GRID):
        row += "1" if grid[gy, gx] else "0"
    print(f'  "{row}",')
print("];")

print("\n// === COMPAGNIE COAST MASK (sea cells adjacent to land) ===")
print("const COMPAGNIE_COAST_MASK: string[] = [")
for gy in range(GRID):
    row = ""
    for gx in range(GRID):
        row += "1" if coast[gy, gx] else "0"
    print(f'  "{row}",')
print("];")
