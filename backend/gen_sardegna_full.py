"""Generate ONE single tall map from south Corsica to north Tunisia, then split into 3 sectors."""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

PROMPT = """Top-down vintage parchment navigation map showing the sea from SOUTHERN CORSICA to NORTHERN TUNISIA. TALL PORTRAIT format (the height should be approximately 3x the width).

LAYOUT (CRITICAL - from top to bottom):
- TOP 8%: Southern tip of CORSICA — rugged coast with small bays, positioned CENTER-LEFT. Only the very southern edge of the island is visible.
- 8-15%: STRAIT OF BONIFACIO — narrow channel with tiny islands (Maddalena archipelago, small rocky dots)
- 15-55%: The ENTIRE ISLAND OF SARDINIA fills this section. The island is CENTERED horizontally:
  * Northern coast (Gallura, Costa Smeralda) with bays and inlets
  * The island widens through its center section
  * Central mountain spine running north-south (subtle relief shading)
  * Western coast with bays (Alghero, Oristano Gulf)
  * Eastern coast more linear
  * Southern tip (Cagliari) with the Gulf of Cagliari bay
- 55-80%: OPEN MEDITERRANEAN SEA — large teal/blue-green water expanse. NO other islands, NO Sicily, NO Italy.
- 80-100%: NORTHERN TUNISIA coast — a wide band of land spanning most of the width. Irregular coastline with Cap Bon peninsula on the right side pointing northward.

PROPORTIONS: Sardinia should be the dominant landmass (~40% of total area). The sea between Sardinia and Tunisia should be substantial but not excessive (~25%). Tunisia coast should be clearly visible at the bottom (~15%).

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture with slight relief shading for mountains. NO green anywhere.
OCEAN/SEA COLOR: muted teal/blue-green (#7A9A8A to #8DAD9C), clearly distinct from land. Slightly textured.
ABSOLUTELY NO: text, labels, borders, compass rose, decorations, legend, grid lines, political boundaries, yellow border frame, icons, markers.
Style: 1920s aviator navigation chart on aged parchment paper. Aéropostale route map aesthetic."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    print("Generating single tall Sardegna map...")
    try:
        images = await image_gen.generate_images(
            prompt=PROMPT,
            model="gpt-image-1",
            number_of_images=1
        )
        if images and len(images) > 0:
            with open("/app/frontend/assets/images/sardegna-full.png", "wb") as f:
                f.write(images[0])
            print("✓ Full map saved")
            
            # Now split into 3 sectors
            from PIL import Image
            full = Image.open("/app/frontend/assets/images/sardegna-full.png")
            w, h = full.size
            print(f"Full map size: {w}x{h}")
            
            # Resize to 1024 wide, maintain aspect ratio
            target_w = 1024
            scale = target_w / w
            new_h = int(h * scale)
            full_resized = full.resize((target_w, new_h), Image.LANCZOS)
            print(f"Resized: {target_w}x{new_h}")
            
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
            
            # Build composite
            composite = Image.new('RGB', (target_w, target_sector_h * 3))
            composite.paste(north_r, (0, 0))
            composite.paste(center_r, (0, target_sector_h))
            composite.paste(south_r, (0, target_sector_h * 2))
            composite.save("/app/frontend/assets/images/sardegna-map.png")
            print(f"✓ Composite: {composite.size}")
            
        else:
            print("✗ No image generated")
    except Exception as e:
        print(f"✗ Error: {e}")

asyncio.run(main())
