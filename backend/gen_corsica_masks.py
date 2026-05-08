"""Generate land masks for the new Corsica North/South maps."""
from PIL import Image
import numpy as np

def gen_mask(image_path: str, threshold: int = 30, sample_threshold: float = 0.55):
    img = Image.open(image_path).convert('RGB')
    arr = np.array(img)
    h, w = arr.shape[:2]
    r = arr[:,:,0].astype(float)
    b = arr[:,:,2].astype(float)
    diff = r - b
    print(f"[{image_path}] R-B diff: min={diff.min():.0f} max={diff.max():.0f} mean={diff.mean():.0f}")
    land_mask = diff > threshold

    GRID = 50
    grid = np.zeros((GRID, GRID), dtype=int)
    for gy in range(GRID):
        for gx in range(GRID):
            y1 = int(gy * h / GRID)
            y2 = int((gy + 1) * h / GRID)
            x1 = int(gx * w / GRID)
            x2 = int((gx + 1) * w / GRID)
            pct = land_mask[y1:y2, x1:x2].mean()
            grid[gy, gx] = 1 if pct > sample_threshold else 0
    return grid

def print_mask(grid, label):
    print(f"\n=== {label} ===")
    for gy in range(50):
        row = ""
        for gx in range(50):
            row += "█" if grid[gy, gx] else "·"
        print(f"{row}  y={gy/50:.2f}")

def export_ts(grid, varname):
    print(f"\n// === {varname} ===")
    print(f"const {varname}: string[] = [")
    for gy in range(50):
        row = ""
        for gx in range(50):
            row += "1" if grid[gy, gx] else "0"
        print(f'  "{row}",')
    print("];")

print("\n############# CORSICA NORTH #############")
mask_north = gen_mask("/app/frontend/assets/images/corsica-map-north.png")
print_mask(mask_north, "CORSICA NORTH")
export_ts(mask_north, "CORSICA_NORTH_MASK")

print("\n############# CORSICA SOUTH #############")
mask_south = gen_mask("/app/frontend/assets/images/corsica-map-south.png")
print_mask(mask_south, "CORSICA SOUTH")
export_ts(mask_south, "CORSICA_SOUTH_MASK")
