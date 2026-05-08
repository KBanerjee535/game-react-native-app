"""Generate 3 Sardegna sector maps like Corsica: each 1024x1536, NO stretching."""
import asyncio
import os
import numpy as np
from dotenv import load_dotenv
load_dotenv()
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from PIL import Image

PROMPT_NORTH = """Top-down vintage parchment map. PORTRAIT orientation.

LAYOUT (CRITICAL):
- TOP 35%: Open sea with a small fragment of the southern tip of CORSICA island emerging from the top edge, center-right. Only the very bottom coast of Corsica is visible. The coast is irregular with bays.
- MIDDLE 20%: STRAIT OF BONIFACIO — narrow channel of sea between Corsica and Sardinia, with a few tiny rocky islands (Maddalena archipelago) visible as small dots.
- BOTTOM 45%: The NORTHERN COAST of SARDINIA island, emerging from the bottom. Sardinia's north coast (Gallura region, Costa Smeralda) stretches across 50-60% of the image width, roughly centered. The coast has deep bays and inlets. The island extends beyond the bottom edge.

The land should be WIDE and naturally proportioned, not thin strips.

LAND COLOR: warm parchment beige (#D4B896 to #E8D5B5), subtle relief texture. NO green.
SEA COLOR: muted teal (#7A9A8A to #8DAD9C).
NO text, labels, borders, compass, decorations, frame.
Style: 1920s aviator parchment navigation chart."""

PROMPT_CENTER = """Top-down vintage parchment map. PORTRAIT orientation.

LAYOUT (CRITICAL):
- The ENTIRE image shows SARDINIA island viewed from above
- The island is CENTERED both horizontally and vertically
- Sardinia takes approximately 70% of image height and 45-55% of image width
- The island is WIDE (like a shoe sole or a bean shape), NOT a thin strip
- Northern coast (Gallura, Olbia) at the very top, continuing beyond the top edge
- Southern coast (Cagliari gulf, wide bay) at the bottom, continuing beyond the bottom edge
- Western coast: Gulf of Oristano (large bay indent), Alghero area
- Eastern coast: straighter, Tyrrhenian coast
- Central mountain spine running north-south (subtle relief)
- Sea visible on all sides of the island

LAND COLOR: warm parchment beige (#D4B896 to #E8D5B5), subtle mountain relief. NO green.
SEA COLOR: muted teal (#7A9A8A to #8DAD9C).
NO text, labels, borders, compass, decorations, frame.
Style: 1920s aviator parchment navigation chart."""

PROMPT_SOUTH = """Top-down vintage parchment map. PORTRAIT orientation.

LAYOUT (CRITICAL):
- TOP 40%: The SOUTHERN TIP of SARDINIA island emerging from the top edge. The bottom of Sardinia (Cagliari area) stretches across 40-50% of image width, roughly centered. The coast has the wide Gulf of Cagliari. The island extends beyond the top edge.
- MIDDLE 25%: OPEN MEDITERRANEAN SEA — clear blue-green water with NO land at all. This sea gap must be clearly visible and substantial.
- BOTTOM 35%: NORTHERN TUNISIA coast. A wide continental coastline stretching across 60-70% of the image width. Cap Bon peninsula pointing upward on the right side. The Tunisian coast has bays and an irregular shape. Shows significant amount of Tunisia land.

The land should be WIDE and naturally proportioned, not thin strips.

LAND COLOR: warm parchment beige (#D4B896 to #E8D5B5), subtle relief. NO green.
SEA COLOR: muted teal (#7A9A8A to #8DAD9C).
NO text, labels, borders, compass, decorations, frame.
Style: 1920s aviator parchment navigation chart."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    sectors = {}
    for name, prompt in [("north", PROMPT_NORTH), ("center", PROMPT_CENTER), ("south", PROMPT_SOUTH)]:
        print(f"🗺️ Generating {name}...")
        images = await image_gen.generate_images(prompt=prompt, model="gpt-image-1", number_of_images=1)
        if images:
            path = f"/app/frontend/assets/images/sardegna-map-{name}.png"
            with open(path, "wb") as f:
                f.write(images[0])
            img = Image.open(path)
            # Resize to exactly 1024x1536 (no stretching, native generation ratio)
            img_r = img.resize((1024, 1536), Image.LANCZOS)
            img_r.save(path)
            sectors[name] = img_r
            print(f"  ✓ {name}: {img_r.size}")
    
    if len(sectors) == 3:
        # Composite: stack 3 sectors vertically (1024 x 4608)
        composite = Image.new('RGB', (1024, 4608))
        composite.paste(sectors['north'], (0, 0))
        composite.paste(sectors['center'], (0, 1536))
        composite.paste(sectors['south'], (0, 3072))
        composite.save("/app/frontend/assets/images/sardegna-map.png")
        print(f"\n✓ Composite: {composite.size}")
        
        # Generate masks
        print("\n🗺️ Land masks:")
        for name, img in sectors.items():
            arr = np.array(img)
            mask_rows = []
            grid = 50
            ch, cw = img.height // grid, img.width // grid
            for row in range(grid):
                s = ""
                for col in range(grid):
                    cell = arr[row*ch:(row+1)*ch, col*cw:(col+1)*cw]
                    rm = float(cell[:,:,0].mean())
                    bm = float(cell[:,:,2].mean())
                    s += "1" if (rm - bm > 20 and rm > 150) else "0"
                mask_rows.append(s)
            land = sum(r.count('1') for r in mask_rows)
            print(f"\nsardegna_{name}: {land}/2500 ({100*land/2500:.1f}%)")
            for r in mask_rows:
                print(f'    "{r}",')
    
    print("\n✅ Done!")

asyncio.run(main())
