"""Create Sardegna map from user reference: detect land from ORIGINAL colors, then restyle."""
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
import urllib.request

print("📥 Downloading reference image...")
urllib.request.urlretrieve(
    "https://customer-assets.emergentagent.com/job_862e468b-066f-4d53-aee7-e77e97c190af/artifacts/mcf9u3gj_image.png",
    "/tmp/sardegna_ref.png"
)

ref = Image.open("/tmp/sardegna_ref.png")
w, h = ref.size
print(f"Reference: {w}x{h}")

# Upscale to 1024 wide first
target_w = 1024
scale = target_w / w
new_h = int(h * scale)
ref_up = ref.resize((target_w, new_h), Image.LANCZOS)
print(f"Upscaled: {ref_up.size}")

# Detect land/sea on ORIGINAL colors (blue = sea, brown/green = land)
arr_orig = np.array(ref_up, dtype=np.float32)
r, g, b = arr_orig[:,:,0], arr_orig[:,:,1], arr_orig[:,:,2]

# Sea: blue dominant (B > R and B > G by some margin)
# Land: brown/green/tan (R > B or G > B)  
sea_mask = (b > r + 5) & (b > 90)
land_mask = ~sea_mask

# Now create parchment-styled version
result = np.zeros_like(arr_orig)

# Brightness for variation
brightness = (r * 0.3 + g * 0.59 + b * 0.11) / 255.0

# Land: warm parchment beige with mountain texture
land_var = (brightness - 0.5) * 50
result[:,:,0] = np.where(land_mask, np.clip(210 + land_var, 175, 240), np.clip(120 + (brightness-0.5)*25, 100, 145))
result[:,:,1] = np.where(land_mask, np.clip(182 + land_var*0.7, 148, 210), np.clip(152 + (brightness-0.5)*20, 130, 170))
result[:,:,2] = np.where(land_mask, np.clip(148 + land_var*0.5, 118, 180), np.clip(136 + (brightness-0.5)*18, 118, 155))

result = np.clip(result, 0, 255).astype(np.uint8)
parchment = Image.fromarray(result)
parchment = parchment.filter(ImageFilter.GaussianBlur(radius=2.0))
enhancer = ImageEnhance.Contrast(parchment)
parchment = enhancer.enhance(0.9)

# Now we have a 1024 x new_h parchment map
# Need to split into 3 sectors and resize to 1024x1536 each
# The image ratio is 1:2.58, so splitting into 3 gives 1:0.86 sectors
# Stretching from 1:0.86 to 1:1.5 = 1.74x vertical stretch (acceptable!)

sector_h = new_h // 3
north = parchment.crop((0, 0, target_w, sector_h))
center = parchment.crop((0, sector_h, target_w, sector_h * 2))
south = parchment.crop((0, sector_h * 2, target_w, new_h))

target_sh = 1536
north_r = north.resize((target_w, target_sh), Image.LANCZOS)
center_r = center.resize((target_w, target_sh), Image.LANCZOS)
south_r = south.resize((target_w, target_sh), Image.LANCZOS)

north_r.save("/app/frontend/assets/images/sardegna-map-north.png")
center_r.save("/app/frontend/assets/images/sardegna-map-center.png")
south_r.save("/app/frontend/assets/images/sardegna-map-south.png")
print(f"✓ 3 sectors saved ({target_w}x{target_sh} each)")

composite = Image.new('RGB', (target_w, target_sh * 3))
composite.paste(north_r, (0, 0))
composite.paste(center_r, (0, target_sh))
composite.paste(south_r, (0, target_sh * 2))
composite.save("/app/frontend/assets/images/sardegna-map.png")
print(f"✓ Composite: {composite.size}")

# Generate masks from the STRETCHED sector images
# Detect using the new parchment colors: land R > 170, R-B > 12
print("\n🗺️ Generating land masks...")
for name, img in [("north", north_r), ("center", center_r), ("south", south_r)]:
    arr = np.array(img)
    mask_rows = []
    grid = 50
    cell_h = img.height // grid
    cell_w = img.width // grid
    
    for row in range(grid):
        row_str = ""
        for col in range(grid):
            y1 = row * cell_h
            y2 = min((row + 1) * cell_h, img.height)
            x1 = col * cell_w
            x2 = min((col + 1) * cell_w, img.width)
            cell = arr[y1:y2, x1:x2]
            r_mean = float(cell[:,:,0].mean())
            b_mean = float(cell[:,:,2].mean())
            is_land = (r_mean - b_mean) > 12 and r_mean > 165
            row_str += "1" if is_land else "0"
        mask_rows.append(row_str)
    
    land = sum(r.count('1') for r in mask_rows)
    print(f"\nsardegna_{name}: {land}/2500 ({100*land/2500:.1f}%)")
    for r in mask_rows:
        print(f'    "{r}",')

print("\n✅ Done!")
