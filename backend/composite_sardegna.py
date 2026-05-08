"""Composite 3 Sardegna maps into a single vertical image + generate land masks."""
from PIL import Image
import numpy as np

# Load the 3 maps
north = Image.open('/app/frontend/assets/images/sardegna-map-north.png')
center = Image.open('/app/frontend/assets/images/sardegna-map-center.png')
south = Image.open('/app/frontend/assets/images/sardegna-map-south.png')

print(f"North: {north.size}, Center: {center.size}, South: {south.size}")

# Resize all to 1024x1536
target_w, target_h = 1024, 1536
north_r = north.resize((target_w, target_h), Image.LANCZOS)
center_r = center.resize((target_w, target_h), Image.LANCZOS)
south_r = south.resize((target_w, target_h), Image.LANCZOS)

# Save resized individual maps
north_r.save('/app/frontend/assets/images/sardegna-map-north.png')
center_r.save('/app/frontend/assets/images/sardegna-map-center.png')
south_r.save('/app/frontend/assets/images/sardegna-map-south.png')

# Create composite: 1024 x 4608 (3 * 1536)
composite = Image.new('RGB', (target_w, target_h * 3))
composite.paste(north_r, (0, 0))
composite.paste(center_r, (0, target_h))
composite.paste(south_r, (0, target_h * 2))
composite.save('/app/frontend/assets/images/sardegna-map.png')
print(f"Composite: {composite.size}")

# Generate land masks (50x50) for each sector
def generate_mask_strings(image_path):
    img = Image.open(image_path).resize((50, 50), Image.LANCZOS)
    arr = np.array(img)
    rows = []
    for y in range(50):
        row = ""
        for x in range(50):
            r, g, b = float(arr[y, x, 0]), float(arr[y, x, 1]), float(arr[y, x, 2])
            is_land = (r > 165 and g > 125 and b < 145 and (r - b) > 40)
            row += "1" if is_land else "0"
        rows.append(row)
    return rows

for name, path in [("sardegna_north", '/app/frontend/assets/images/sardegna-map-north.png'),
                    ("sardegna_center", '/app/frontend/assets/images/sardegna-map-center.png'),
                    ("sardegna_south", '/app/frontend/assets/images/sardegna-map-south.png')]:
    rows = generate_mask_strings(path)
    land_count = sum(r.count('1') for r in rows)
    print(f"\n{name}: {land_count}/2500 land cells")
    print(f"  {name}: [")
    for r in rows:
        print(f'    "{r}",')
    print("  ],")

print("\nDone!")
