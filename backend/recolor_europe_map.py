"""
Recolor the Europe map:
1. Change land color to warm parchment beige (#E1CB9F range)
2. Remove country borders (dark lines on land)
3. Keep sea/ocean colors intact
4. Preserve coastline definition
"""
from PIL import Image, ImageFilter
import numpy as np

# Load the original map
img = Image.open('/app/frontend/assets/images/europe-map-vintage-new.png')
arr = np.array(img, dtype=np.float64)
h, w = arr.shape[:2]
print(f"Image: {w}x{h}")

r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]

# --- Step 1: Create land/sea masks ---
diff = r - b
land_mask = diff > 25  # Land: R much higher than B
sea_mask = ~land_mask

# Refine: expand land mask slightly to catch border pixels near coastlines
from scipy import ndimage
land_mask_expanded = ndimage.binary_dilation(land_mask, iterations=2)

# --- Step 2: Detect border lines on land ---
# Borders are darker lines on land areas
brightness = (r + g + b) / 3
# Border pixels: on land but darker than typical land
border_mask = land_mask & (brightness < 210)

# Also detect thin dark lines (high local contrast)
# Use a local std filter approach
from PIL import ImageFilter
gray = img.convert('L')
gray_arr = np.array(gray, dtype=np.float64)

# Local contrast: difference from blurred version
blurred = np.array(img.filter(ImageFilter.GaussianBlur(radius=5)), dtype=np.float64)
local_diff = np.abs(arr - blurred).mean(axis=2)

# Borders: on land, high local contrast OR dark
border_mask2 = land_mask & ((local_diff > 15) | (brightness < 205))

print(f"Border pixels detected: {border_mask2.sum()} ({border_mask2.mean()*100:.1f}%)")

# --- Step 3: Create the target parchment color palette ---
# Target: warm beige parchment like #E1CB9F with texture variation
# Primary: RGB(225, 203, 159) = #E1CB9F
# Lighter:  RGB(240, 225, 190) = #F0E1BE
# Darker:   RGB(205, 180, 135) = #CDB487

# Create a noise texture for natural parchment feel
np.random.seed(42)
noise = np.random.normal(0, 1, (h, w))
# Smooth the noise for larger-scale texture variation
from scipy.ndimage import gaussian_filter
noise_smooth = gaussian_filter(noise, sigma=15)  # Large-scale variation
noise_fine = gaussian_filter(np.random.normal(0, 1, (h, w)), sigma=3)  # Fine grain

# Normalize noise to 0-1 range
noise_smooth = (noise_smooth - noise_smooth.min()) / (noise_smooth.max() - noise_smooth.min())
noise_fine = (noise_fine - noise_fine.min()) / (noise_fine.max() - noise_fine.min())

# Combine: 70% large texture + 30% fine grain
noise_combined = 0.7 * noise_smooth + 0.3 * noise_fine
noise_combined = (noise_combined - noise_combined.min()) / (noise_combined.max() - noise_combined.min())

# Target color range
# Base: #E1CB9F (225, 203, 159)
# We'll vary from lighter (#F0E1BE = 240,225,190) to slightly darker (#CDB487 = 205,180,135)
target_r = 210 + noise_combined * 30   # 210-240
target_g = 185 + noise_combined * 35   # 185-220
target_b = 140 + noise_combined * 45   # 140-185

# Add some subtle warm brown splotches for realism
splotch_noise = gaussian_filter(np.random.normal(0, 1, (h, w)), sigma=40)
splotch_noise = (splotch_noise - splotch_noise.min()) / (splotch_noise.max() - splotch_noise.min())
splotch_mask = splotch_noise > 0.7  # Occasional darker patches

target_r[splotch_mask] -= 15
target_g[splotch_mask] -= 18
target_b[splotch_mask] -= 12

# --- Step 4: Apply recoloring ---
result = arr.copy()

# Replace ALL land pixels (including borders) with parchment color
result[:,:,0][land_mask] = target_r[land_mask]
result[:,:,1][land_mask] = target_g[land_mask]
result[:,:,2][land_mask] = target_b[land_mask]

# Also fill in border pixels that might have been on the edge
# Use the expanded land mask to catch border residuals near coastlines
edge_only = land_mask_expanded & ~land_mask
# For edge pixels, blend with neighboring land color
result[:,:,0][edge_only] = target_r[edge_only]
result[:,:,1][edge_only] = target_g[edge_only]  
result[:,:,2][edge_only] = target_b[edge_only]

# --- Step 5: Smooth the land areas to remove any border remnants ---
# Apply a gentle blur only on land areas
result_img = Image.fromarray(np.clip(result, 0, 255).astype(np.uint8))
blurred_result = np.array(result_img.filter(ImageFilter.GaussianBlur(radius=2)), dtype=np.float64)

# Only apply blur on land (not on coastlines/sea)
# Erode land mask to avoid blurring coastlines
land_interior = ndimage.binary_erosion(land_mask, iterations=3)
result[:,:,0][land_interior] = blurred_result[:,:,0][land_interior]
result[:,:,1][land_interior] = blurred_result[:,:,1][land_interior]
result[:,:,2][land_interior] = blurred_result[:,:,2][land_interior]

# --- Step 6: Ensure smooth coastline transition ---
# Create a transition zone at the land/sea boundary
coast_zone = land_mask & ~ndimage.binary_erosion(land_mask, iterations=4)
# In the coast zone, blend land color with a slight darkening for definition
result[:,:,0][coast_zone] = np.clip(result[:,:,0][coast_zone] * 0.92, 0, 255)
result[:,:,1][coast_zone] = np.clip(result[:,:,1][coast_zone] * 0.90, 0, 255)
result[:,:,2][coast_zone] = np.clip(result[:,:,2][coast_zone] * 0.88, 0, 255)

# Clip and save
result = np.clip(result, 0, 255).astype(np.uint8)
out = Image.fromarray(result)
out.save('/app/frontend/assets/images/europe-map-vintage-new.png', quality=95)
print("Map recolored and saved!")

# Also save a backup
out.save('/app/backend/europe-map-recolored.png', quality=95)
print("Backup saved to /app/backend/europe-map-recolored.png")
