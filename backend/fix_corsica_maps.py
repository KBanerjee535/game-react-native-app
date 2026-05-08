"""
Fix Corsica maps:
1. Remove yellow border from south map
2. Crop/zoom north map to show only Côte d'Azur + Cap Corse tip
3. Recomposite
"""
from PIL import Image, ImageFilter
import numpy as np

# --- SOUTH MAP: Remove yellow border ---
south = Image.open('/app/frontend/assets/images/corsica-map-south.png')
south_np = np.array(south)
h, w = south_np.shape[:2]

# Detect border: the yellow border pixels have high R, high G, low B
# Find the sea color (teal/blue-green) from the center of the image
# Sample sea color from a known water area (top-right corner)
sea_sample = south_np[10:50, w-50:w-10]
sea_color = np.median(sea_sample, axis=(0,1)).astype(np.uint8)
print(f"South map: {w}x{h}, Sea color sample: {sea_color}")

# Check border width by scanning from edges
def find_border_width(img_np, side):
    """Find where the border ends by checking color similarity to sea"""
    h, w = img_np.shape[:2]
    threshold = 80  # Color distance threshold
    
    for offset in range(0, min(60, min(h,w)//4)):
        if side == 'top':
            row = img_np[offset, w//4:3*w//4]
        elif side == 'bottom':
            row = img_np[h-1-offset, w//4:3*w//4]
        elif side == 'left':
            row = img_np[h//4:3*h//4, offset]
        elif side == 'right':
            row = img_np[h//4:3*h//4, w-1-offset]
        
        # Check if most pixels are "border-like" (yellowish)
        r, g, b = row[:, 0].mean(), row[:, 1].mean(), row[:, 2].mean()
        # Yellow border: R>180, G>150, B<130
        if r > 170 and g > 140 and b < 140:
            continue
        else:
            return offset
    return 0

border_top = find_border_width(south_np, 'top')
border_bottom = find_border_width(south_np, 'bottom')
border_left = find_border_width(south_np, 'left')
border_right = find_border_width(south_np, 'right')
print(f"Border widths - T:{border_top} B:{border_bottom} L:{border_left} R:{border_right}")

# Crop the border and resize back to original dimensions
if max(border_top, border_bottom, border_left, border_right) > 0:
    # Add small safety margin
    margin = 2
    crop_top = max(0, border_top - margin)
    crop_bottom = max(0, border_bottom - margin)
    crop_left = max(0, border_left - margin)
    crop_right = max(0, border_right - margin)
    
    cropped = south.crop((crop_left, crop_top, w - crop_right, h - crop_bottom))
    # Resize back to original size
    south_fixed = cropped.resize((w, h), Image.LANCZOS)
    south_fixed.save('/app/frontend/assets/images/corsica-map-south.png')
    print(f"South map: cropped border and resized to {w}x{h}")
else:
    print("No significant border detected, trying alternative method")
    # Alternative: just trim 15px from each side and resize
    trim = 15
    cropped = south.crop((trim, trim, w - trim, h - trim))
    south_fixed = cropped.resize((w, h), Image.LANCZOS)
    south_fixed.save('/app/frontend/assets/images/corsica-map-south.png')
    print(f"South map: trimmed {trim}px and resized to {w}x{h}")

# --- NORTH MAP: Zoom into Côte d'Azur + Cap Corse tip ---
north = Image.open('/app/frontend/assets/images/corsica-map-north.png')
nh, nw = north.size[1], north.size[0]
print(f"\nNorth map: {nw}x{nh}")

# The north map shows Côte d'Azur at top ~30-40% and Corsica at center-bottom
# We want to crop to show only the top ~55% (Côte d'Azur + just Cap Corse tip)
# This will zoom in on the Côte d'Azur portion
crop_height = int(nh * 0.55)  # Take top 55% of the image
north_cropped = north.crop((0, 0, nw, crop_height))
# Resize back to original dimensions
north_fixed = north_cropped.resize((nw, nh), Image.LANCZOS)
north_fixed.save('/app/frontend/assets/images/corsica-map-north.png')
print(f"North map: cropped to top {crop_height}px and resized to {nw}x{nh}")

# --- RECOMPOSITE ---
north_final = Image.open('/app/frontend/assets/images/corsica-map-north.png')
south_final = Image.open('/app/frontend/assets/images/corsica-map-south.png')

composite = Image.new('RGB', (1024, 3072))
# Resize both to 1024x1536 if needed
north_resized = north_final.resize((1024, 1536), Image.LANCZOS)
south_resized = south_final.resize((1024, 1536), Image.LANCZOS)

composite.paste(north_resized, (0, 0))
composite.paste(south_resized, (0, 1536))
composite.save('/app/frontend/assets/images/corsica-map.png')
print(f"\nComposite saved: {composite.size}")
print("Done!")
