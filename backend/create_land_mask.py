"""Create a land mask for the Europe map and export it as a compact array."""
from PIL import Image
import numpy as np
import json

img = Image.open('/app/frontend/assets/images/europe-map-vintage-new.png')
arr = np.array(img)
h, w = arr.shape[:2]

r, g, b = arr[:,:,0].astype(float), arr[:,:,1].astype(float), arr[:,:,2].astype(float)

# Better sea detection: blue areas where B channel is relatively higher
# Sea: B is closer to or higher than R, and overall bluish
# Land: R significantly higher than B (ochre/yellow)
# Try: land = (R - B) > threshold
diff = r - b
print(f"R-B diff: min={diff.min():.0f} max={diff.max():.0f} mean={diff.mean():.0f}")
print(f"Percentiles: 10%={np.percentile(diff, 10):.0f} 25%={np.percentile(diff, 25):.0f} 50%={np.percentile(diff, 50):.0f} 75%={np.percentile(diff, 75):.0f}")

# Land: R-B > 40 (ochre has much more red than blue)
# Sea: R-B < 20 (blue has similar or more blue than red)
threshold = 30
land_mask = diff > threshold

# Create a compact grid (50x50)
GRID = 50
grid = np.zeros((GRID, GRID), dtype=int)
for gy in range(GRID):
    for gx in range(GRID):
        y1 = int(gy * h / GRID)
        y2 = int((gy + 1) * h / GRID)
        x1 = int(gx * w / GRID)
        x2 = int((gx + 1) * w / GRID)
        pct = land_mask[y1:y2, x1:x2].mean()
        grid[gy, gx] = 1 if pct > 0.55 else 0

# Print visual grid
print("\n=== Land Mask 50x50 (threshold R-B > 30) ===")
sea_count = 0
land_count = 0
for gy in range(GRID):
    row = ""
    for gx in range(GRID):
        if grid[gy, gx]:
            row += "█"
            land_count += 1
        else:
            row += "·"
            sea_count += 1
    print(f"{row}  y={gy/GRID:.2f}")
print(f"\nLand: {land_count}, Sea: {sea_count} ({sea_count/(land_count+sea_count)*100:.0f}% sea)")

# Export as a compact string for embedding in TypeScript
# Each row = string of 0s and 1s
rows = []
for gy in range(GRID):
    row = ""
    for gx in range(GRID):
        row += "1" if grid[gy, gx] else "0"
    rows.append(row)

print("\n// TypeScript land mask (50x50):")
print("const EUROPE_LAND_MASK: string[] = [")
for row in rows:
    print(f'  "{row}",')
print("];")
print(f"\n// Usage: EUROPE_LAND_MASK[Math.floor(y * 50)][Math.floor(x * 50)] === '1' means land")
