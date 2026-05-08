"""Regenerate Sardegna map: ONE single tall map from south Corsica to north Tunisia, split into 3 vertical sectors."""
import asyncio
import os
import numpy as np
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

PROMPT = """Top-down vintage parchment navigation map showing the Mediterranean from SOUTHERN CORSICA to NORTHERN TUNISIA. TALL PORTRAIT format (height = 3x width).

LAYOUT (CRITICAL - from top to bottom):
- TOP 10%: Southern tip of CORSICA island — rugged mountainous coast with small bays, positioned CENTER-LEFT. Only the very southern edge visible with thin coastline.
- 10-15%: STRAIT OF BONIFACIO — narrow turquoise channel with tiny rocky islands (Maddalena archipelago as small dots)
- 15-60%: The ENTIRE ISLAND OF SARDINIA (SARDEGNA) dominates this zone. The island is CENTERED:
  * Northern coast (Gallura) with deep bays and inlets
  * The island widens through the center with mountain spine (subtle relief)
  * Western coast: bays of Alghero, Gulf of Oristano
  * Eastern coast: more linear, Porto Cervo area
  * Southern tip: Gulf of Cagliari as a wide bay
- 60-82%: OPEN MEDITERRANEAN SEA — vast teal/blue-green water. NO islands, NO Sicily, NO Italy mainland.
- 82-100%: NORTHERN TUNISIA coast — wide band of land across most of the width. Cap Bon peninsula pointing northward on the right. Irregular coastline with small bays.

PROPORTIONS: Sardinia = dominant landmass (~40%). Sea gap between Sardinia and Tunisia = substantial (~22%). Tunisia coast clearly visible at bottom (~18%). Corsica tip small at top (~10%).

COLORS:
- LAND: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture, subtle mountain relief shading. NO green.
- SEA/OCEAN: muted teal blue-green (#7A9A8A to #8DAD9C), clearly distinct from land. Slightly textured like old paper.

ABSOLUTELY NO: text, labels, names, borders, compass rose, decorations, legend, grid lines, political boundaries, yellow border frame, icons, markers, arrows.

Style: 1920s aviator navigation chart on aged parchment paper. Aéropostale route map aesthetic. Clean, readable coastlines."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    print("🗺️ Generating single tall Sardegna map (Corsica → Tunisia)...")
    try:
        images = await image_gen.generate_images(
            prompt=PROMPT,
            model="gpt-image-1",
            number_of_images=1
        )
        if images and len(images) > 0:
            with open("/app/frontend/assets/images/sardegna-full-new.png", "wb") as f:
                f.write(images[0])
            print("✓ Full map saved as sardegna-full-new.png")
            
            from PIL import Image
            full = Image.open("/app/frontend/assets/images/sardegna-full-new.png")
            w, h = full.size
            print(f"  Original size: {w}x{h}")
            
            # Resize to 1024 wide, maintain aspect ratio
            target_w = 1024
            scale = target_w / w
            new_h = int(h * scale)
            full_resized = full.resize((target_w, new_h), Image.LANCZOS)
            print(f"  Resized: {target_w}x{new_h}")
            
            # Split into 3 equal parts
            sector_h = new_h // 3
            
            north = full_resized.crop((0, 0, target_w, sector_h))
            center = full_resized.crop((0, sector_h, target_w, sector_h * 2))
            south = full_resized.crop((0, sector_h * 2, target_w, new_h))
            
            # Resize each sector to 1024x1536
            target_sector_h = 1536
            north_r = north.resize((target_w, target_sector_h), Image.LANCZOS)
            center_r = center.resize((target_w, target_sector_h), Image.LANCZOS)
            south_r = south.resize((target_w, target_sector_h), Image.LANCZOS)
            
            north_r.save("/app/frontend/assets/images/sardegna-map-north.png")
            center_r.save("/app/frontend/assets/images/sardegna-map-center.png")
            south_r.save("/app/frontend/assets/images/sardegna-map-south.png")
            print("✓ Split into 3 sectors (1024x1536 each)")
            
            # Build composite for the game (1024 x 4608)
            composite = Image.new('RGB', (target_w, target_sector_h * 3))
            composite.paste(north_r, (0, 0))
            composite.paste(center_r, (0, target_sector_h))
            composite.paste(south_r, (0, target_sector_h * 2))
            composite.save("/app/frontend/assets/images/sardegna-map.png")
            print(f"✓ Composite: {composite.size}")
            
            # Generate land masks (50x50) for each sector
            print("\n🗺️ Generating land masks...")
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
                        r_mean = cell[:,:,0].mean()
                        g_mean = cell[:,:,1].mean()
                        b_mean = cell[:,:,2].mean()
                        
                        # Land detection: R-B > 25 and R > 150 (parchment beige vs teal sea)
                        is_land = (r_mean - b_mean) > 25 and r_mean > 150
                        row_str += "1" if is_land else "0"
                    
                    mask_rows.append(row_str)
                
                land_count = sum(r.count('1') for r in mask_rows)
                total = grid * grid
                print(f"  {name}: {land_count}/{total} land cells ({100*land_count/total:.1f}%)")
                print(f"    Top 5 rows: {mask_rows[:5]}")
                print(f"    Bottom 5: {mask_rows[-5:]}")
                
                # Write mask
                with open(f"/tmp/{name}_mask.txt", "w") as f:
                    for r in mask_rows:
                        f.write(f'    "{r}",\n')
            
            print("\n✅ Done! Check the images and masks.")
        else:
            print("✗ No image generated")
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()

asyncio.run(main())
