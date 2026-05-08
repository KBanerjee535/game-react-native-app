"""Generate land masks for Corsica halves from the composite image."""
from PIL import Image
import numpy as np

# Use the south image (it has full Corsica, well-positioned and centered)
# Crop into TOP HALF (north Corsica) and BOTTOM HALF (south Corsica)

src = Image.open("/app/frontend/assets/images/corsica-map-south.png").convert('RGB')
W, H = src.size
print(f"Source size: {W}x{H}")

# Composite: keep image as-is but resize to 1024x3072 (2:1 height ratio after split)
# Actually rendering uses height*2 with top:0 (TL=north visible) or top:-height (BL=south visible)
# So composite_image dimensions: width = original W, height = original H (single image), but rendered 2x tall
# We need the image to display the full Corsica when rendered at height*2 with proper top offset

# Simpler: just use the corsica-map-south.png as the corsica-map.png
# When rendered at height*2 with top:0 → top half of image shown (north of Corsica)
# When rendered at height*2 with top:-height → bottom half of image shown (south of Corsica)
# This gives us the desired effect: north sector = north half of Corsica, south sector = south half

# Save as composite
src.save("/app/frontend/assets/images/corsica-map.png", "PNG")
print("✓ corsica-map.png saved (full Corsica image)")

# Now generate the masks for each half
arr = np.array(src)
h, w = arr.shape[:2]
r = arr[:,:,0].astype(float)
g = arr[:,:,1].astype(float)
b = arr[:,:,2].astype(float)

# Better land detection: land is BRIGHT and YELLOWISH (high R, high G, low B)
# Sea is darker and greenish-blue
brightness = (r + g + b) / 3
# Land: bright AND r > b significantly
land_mask = (r - b > 50) & (r > 160)
print(f"R-B>50 AND R>160: land pixels = {land_mask.sum()} / {h*w} = {land_mask.mean()*100:.1f}%")

GRID = 50

# Generate mask for the WHOLE image (50x50 covering full image)
def img_to_mask(land_arr, h, w):
    grid = np.zeros((GRID, GRID), dtype=int)
    for gy in range(GRID):
        for gx in range(GRID):
            y1 = int(gy * h / GRID)
            y2 = int((gy + 1) * h / GRID)
            x1 = int(gx * w / GRID)
            x2 = int((gx + 1) * w / GRID)
            pct = land_arr[y1:y2, x1:x2].mean()
            grid[gy, gx] = 1 if pct > 0.5 else 0
    return grid

# Mask covering top half of image (when rendered north sector at height*2 with top:0)
# Image will be rendered at height*2, but only top half is visible (y_screen 0-1 → y_image 0-0.5)
# So mask for north sector: covers rows 0 to H/2 of image, mapped to 50 rows
top_half_arr = land_mask[:h//2, :]
mask_north = img_to_mask(top_half_arr, h//2, w)

# Mask covering bottom half of image (south sector at height*2 with top:-height)
# y_screen 0-1 → y_image 0.5-1.0
bot_half_arr = land_mask[h//2:, :]
mask_south = img_to_mask(bot_half_arr, h - h//2, w)

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

print_mask(mask_north, "CORSICA NORTH (top half of image)")
print_mask(mask_south, "CORSICA SOUTH (bottom half of image)")

export_ts(mask_north, "corsica_north")
export_ts(mask_south, "corsica_south")
