"""Regenerate Sardegna map v2: stricter prompt for Corsica-Sardinia-Tunisia layout."""
import asyncio
import os
import numpy as np
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

PROMPT = """A top-down vintage map showing three distinct landmasses separated by sea, arranged vertically from top to bottom:

1. TOP SECTION (top 8%): A small rocky coastline fragment (representing southern Corsica). Just the very tip visible, shaped like an inverted triangle.

2. UPPER SEA (8-12%): A narrow strait with a few tiny dots (tiny islands).

3. MIDDLE SECTION (12-55%): A large elongated island (representing Sardinia) CENTERED horizontally. It has:
   - Irregular coastline with bays and inlets
   - Slightly wider in the upper portion, narrower toward the bottom
   - A prominent bay/gulf at the very bottom of the island
   - Subtle mountain texture in the interior

4. LOWER SEA (55-78%): A large expanse of open water. This MUST be clearly visible as a big gap with NO land.

5. BOTTOM SECTION (78-100%): A wide band of continental coastline (representing northern Tunisia) stretching across most of the image width. The coastline is irregular with a peninsula jutting upward on the right side.

CRITICAL REQUIREMENTS:
- The BOTTOM coastline (Tunisia) MUST BE CLEARLY VISIBLE occupying the bottom 20% of the image
- Between the island and the bottom coastline there MUST be a large sea gap (at least 20% of image height)
- The three landmasses MUST be clearly separated by sea water

COLORS: Land = warm sandy beige/tan (#D4B896 to #E8D5B5). Sea = muted teal (#7A9A8A to #8DAD9C).
NO text, NO labels, NO borders, NO compass, NO decorations, NO frame.
Style: aged parchment paper, 1920s aviation chart aesthetic."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    print("🗺️ Generating Sardegna map v2 (with Tunisia)...")
    try:
        images = await image_gen.generate_images(
            prompt=PROMPT,
            model="gpt-image-1",
            number_of_images=1
        )
        if images and len(images) > 0:
            with open("/app/frontend/assets/images/sardegna-full-new.png", "wb") as f:
                f.write(images[0])
            print("✓ Full map saved")
            
            from PIL import Image
            full = Image.open("/app/frontend/assets/images/sardegna-full-new.png")
            w, h = full.size
            print(f"  Original size: {w}x{h}")
            
            # Resize to 1024 wide
            target_w = 1024
            scale = target_w / w
            new_h = int(h * scale)
            full_resized = full.resize((target_w, new_h), Image.LANCZOS)
            
            # Split into 3 equal parts
            sector_h = new_h // 3
            north = full_resized.crop((0, 0, target_w, sector_h))
            center = full_resized.crop((0, sector_h, target_w, sector_h * 2))
            south = full_resized.crop((0, sector_h * 2, target_w, new_h))
            
            # Resize each to 1024x1536
            target_sector_h = 1536
            north_r = north.resize((target_w, target_sector_h), Image.LANCZOS)
            center_r = center.resize((target_w, target_sector_h), Image.LANCZOS)
            south_r = south.resize((target_w, target_sector_h), Image.LANCZOS)
            
            north_r.save("/app/frontend/assets/images/sardegna-map-north.png")
            center_r.save("/app/frontend/assets/images/sardegna-map-center.png")
            south_r.save("/app/frontend/assets/images/sardegna-map-south.png")
            print("✓ 3 sectors saved")
            
            # Composite
            composite = Image.new('RGB', (target_w, target_sector_h * 3))
            composite.paste(north_r, (0, 0))
            composite.paste(center_r, (0, target_sector_h))
            composite.paste(south_r, (0, target_sector_h * 2))
            composite.save("/app/frontend/assets/images/sardegna-map.png")
            print(f"✓ Composite: {composite.size}")
            
            # Generate land masks
            print("\n🗺️ Generating land masks...")
            masks = {}
            for name, img in [("sardegna_north", north_r), ("sardegna_center", center_r), ("sardegna_south", south_r)]:
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
                        g_mean = float(cell[:,:,1].mean())
                        b_mean = float(cell[:,:,2].mean())
                        
                        # Land: warm beige (R high, R-B big gap, R > G)
                        # Sea: teal (G close to B, R lower)
                        r_b_diff = r_mean - b_mean
                        is_land = r_b_diff > 20 and r_mean > 145
                        row_str += "1" if is_land else "0"
                    mask_rows.append(row_str)
                
                masks[name] = mask_rows
                land_count = sum(r.count('1') for r in mask_rows)
                print(f"  {name}: {land_count}/2500 ({100*land_count/2500:.1f}%)")
            
            # Print TypeScript format
            print("\n=== TypeScript masks ===")
            for name, rows in masks.items():
                print(f"  {name}: [")
                for r in rows:
                    print(f'    "{r}",')
                print(f"  ],")
            
        else:
            print("✗ No image")
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()

asyncio.run(main())
