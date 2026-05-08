"""Analyze the new Europe map to find land vs sea regions based on color."""
from PIL import Image
import numpy as np

img = Image.open('/app/frontend/assets/images/europe-map-vintage-new.png')
arr = np.array(img)
h, w = arr.shape[:2]

print(f"Image size: {w}x{h}")
print(f"Mean brightness: {arr.mean():.1f}/255")

# Land is warm ochre/yellow (R > G > B, relatively high R and G)
# Sea is blue (B > R, and B is relatively high)
r, g, b = arr[:,:,0].astype(float), arr[:,:,1].astype(float), arr[:,:,2].astype(float)

# Create land mask: land has more red+green than blue
# A pixel is "land" if R > B+20 AND G > B-10 (ochre/yellow tones)
land_mask = (r > b + 15) & (g > b - 5) & (r > 100)

# Print land percentage in each region (20x20 grid)
grid_h, grid_w = 20, 20
print("\n=== Land percentage per grid cell (20x20) ===")
print("(Coordinates are normalized 0-1, land% > 60% = LAND)")
print()
for gy in range(grid_h):
    for gx in range(grid_w):
        y1 = int(gy * h / grid_h)
        y2 = int((gy + 1) * h / grid_h)
        x1 = int(gx * w / grid_w)
        x2 = int((gx + 1) * w / grid_w)
        cell = land_mask[y1:y2, x1:x2]
        land_pct = cell.mean() * 100
        if land_pct > 60:
            char = '█'
        elif land_pct > 30:
            char = '▓'
        elif land_pct > 10:
            char = '░'
        else:
            char = ' '
        print(char, end='')
    nx_min = 0
    nx_max = 1
    ny = (gy + 0.5) / grid_h
    print(f"  y={ny:.2f}")

print()
print("Legend: █=land(>60%) ▓=partial(30-60%) ░=coast(<30%) ' '=sea(<10%)")

# Now find connected land regions more precisely
# Scan in a 10x10 grid and report land percentage
print("\n=== Detailed land regions for LAND_REGIONS calibration ===")
print("(Only cells with >50% land)")
grid_h2, grid_w2 = 40, 40
for gy in range(grid_h2):
    for gx in range(grid_w2):
        y1 = int(gy * h / grid_h2)
        y2 = int((gy + 1) * h / grid_h2)
        x1 = int(gx * w / grid_w2)
        x2 = int((gx + 1) * w / grid_w2)
        cell = land_mask[y1:y2, x1:x2]
        land_pct = cell.mean() * 100
        if land_pct > 50:
            nx = (gx + 0.5) / grid_w2
            ny = (gy + 0.5) / grid_h2
            print(f"  Land cell: x={nx:.3f} y={ny:.3f} ({land_pct:.0f}%)")
