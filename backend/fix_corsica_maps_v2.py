"""
Fix Corsica maps v2:
1. Crop north map to show only Côte d'Azur + tip of Cap Corse (top 52%)
2. Remove yellow border from south map (aggressive 55px trim)
3. Recomposite
4. Generate new land masks for both maps
"""
from PIL import Image
import numpy as np

# --- NORTH MAP: Crop to Côte d'Azur + Cap Corse tip ---
north = Image.open('/app/frontend/assets/images/corsica-map-north.png')
nw, nh = north.size
print(f"North original: {nw}x{nh}")

# Take top 52% (Côte d'Azur + sea + hint of Cap Corse)
crop_y = int(nh * 0.52)  # ~800px
north_cropped = north.crop((0, 0, nw, crop_y))
north_fixed = north_cropped.resize((nw, nh), Image.LANCZOS)
north_fixed.save('/app/frontend/assets/images/corsica-map-north.png')
print(f"North: cropped to top {crop_y}px ({crop_y/nh:.0%}), resized to {nw}x{nh}")

# --- SOUTH MAP: Remove yellow border ---
south = Image.open('/app/frontend/assets/images/corsica-map-south.png')
sw, sh = south.size
print(f"\nSouth original: {sw}x{sh}")

# Aggressive border removal: 55px from each side
trim = 55
south_cropped = south.crop((trim, trim, sw - trim, sh - trim))
south_fixed = south_cropped.resize((sw, sh), Image.LANCZOS)
south_fixed.save('/app/frontend/assets/images/corsica-map-south.png')
print(f"South: trimmed {trim}px borders, resized to {sw}x{sh}")

# --- RECOMPOSITE ---
north_final = Image.open('/app/frontend/assets/images/corsica-map-north.png')
south_final = Image.open('/app/frontend/assets/images/corsica-map-south.png')

composite = Image.new('RGB', (1024, 3072))
north_r = north_final.resize((1024, 1536), Image.LANCZOS)
south_r = south_final.resize((1024, 1536), Image.LANCZOS)
composite.paste(north_r, (0, 0))
composite.paste(south_r, (0, 1536))
composite.save('/app/frontend/assets/images/corsica-map.png')
print(f"\nComposite: {composite.size}")

# --- GENERATE NEW LAND MASKS (50x50) ---
def generate_mask(image_path, mask_name):
    """Generate a 50x50 binary land mask from an image."""
    img = Image.open(image_path).resize((50, 50), Image.LANCZOS)
    arr = np.array(img)
    
    mask = []
    for y in range(50):
        row = []
        for x in range(50):
            r, g, b = arr[y, x, 0], arr[y, x, 1], arr[y, x, 2]
            # Land detection: warm tones (R>G>B, yellowish/beige)
            # Sea detection: teal/cool tones (G>R or B relatively high)
            r_f, g_f, b_f = float(r), float(g), float(b)
            
            # Land: R>170, G>130, B<140, and R-B > 50
            is_land = (r_f > 165 and g_f > 125 and b_f < 145 and (r_f - b_f) > 40)
            row.append(1 if is_land else 0)
        mask.append(row)
    
    return mask

print("\nGenerating corsica_north mask...")
north_mask = generate_mask('/app/frontend/assets/images/corsica-map-north.png', 'corsica_north')
land_count_n = sum(sum(row) for row in north_mask)
print(f"  Land cells: {land_count_n}/2500")

print("Generating corsica_south mask...")
south_mask = generate_mask('/app/frontend/assets/images/corsica-map-south.png', 'corsica_south')
land_count_s = sum(sum(row) for row in south_mask)
print(f"  Land cells: {land_count_s}/2500")

# Print masks as JS format
def mask_to_js(mask, name):
    lines = [f"  {name}: ["]
    for row in mask:
        lines.append(f"    [{','.join(str(v) for v in row)}],")
    lines.append("  ],")
    return '\n'.join(lines)

print("\n=== CORSICA_NORTH MASK ===")
print(mask_to_js(north_mask, 'corsica_north'))
print("\n=== CORSICA_SOUTH MASK ===")
print(mask_to_js(south_mask, 'corsica_south'))

# Save masks to a temp file for easy copy
with open('/tmp/corsica_masks.txt', 'w') as f:
    f.write(mask_to_js(north_mask, 'corsica_north'))
    f.write('\n')
    f.write(mask_to_js(south_mask, 'corsica_south'))

print("\nMasks saved to /tmp/corsica_masks.txt")
print("Done!")
