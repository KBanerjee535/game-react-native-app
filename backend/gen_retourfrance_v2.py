"""RETOUR FRANCE v2: Better geography, clearer land/sea distinction."""
import asyncio
import os
import numpy as np
from dotenv import load_dotenv
load_dotenv()
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from PIL import Image

PROMPT_NORTH = """Bird's-eye view vintage map, portrait format. Simple, clear cartography.

This map shows FRANCE and NORTHERN SPAIN from above:

TOP HALF: FRANCE occupying most of the width. Clear coastline shapes:
- Brittany peninsula jutting out to the LEFT
- Straight Atlantic coast going south
- The English Channel at the very top
- Mediterranean coast at bottom-right
- FRANCE is a LARGE hexagonal landmass taking 70% of image width

BOTTOM HALF: NORTHERN SPAIN below France
- Pyrenees mountains as a horizontal line separating France from Spain
- Northern Spanish coast (Galicia, Cantabria)
- Bay of Biscay (sea) between France's west coast and Spain's north coast
- Spain continues beyond bottom edge

KEY COLORS (VERY IMPORTANT):
- ALL LAND must be WARM BEIGE color (#D8BC94) - sandy tan parchment
- ALL SEA/OCEAN must be DARK TEAL (#6B8E7B) - clearly darker and greener than land
- Land and sea must have MAXIMUM CONTRAST - no ambiguity

STYLE: Simple flat vintage parchment map. Minimal detail. Clear coastlines. 
NO text, NO labels, NO borders, NO compass, NO decorations, NO frame, NO mountains drawn."""

PROMPT_SOUTH = """Bird's-eye view vintage map, portrait format. Simple, clear cartography.

This map shows SPAIN and NORTH AFRICA from above:

TOP HALF: SPAIN - the full Iberian peninsula
- Portugal on the far left
- Spain's Mediterranean coast on the right with a few small Balearic islands
- Central plateau (Meseta) as flat beige land
- Spain takes 65% of image width
- Continues from top edge (connecting to northern Spain above)

NARROW MIDDLE BAND: Strait of Gibraltar - a thin channel of dark teal sea

BOTTOM THIRD: NORTH AFRICA
- Morocco and Algeria coastline stretching across the full width
- Substantial land area visible
- Rif mountains coast

KEY COLORS (VERY IMPORTANT):
- ALL LAND must be WARM BEIGE color (#D8BC94) - sandy tan parchment
- ALL SEA/OCEAN must be DARK TEAL (#6B8E7B) - clearly darker and greener than land
- Land and sea must have MAXIMUM CONTRAST - no ambiguity

STYLE: Simple flat vintage parchment map. Minimal detail. Clear coastlines.
NO text, NO labels, NO borders, NO compass, NO decorations, NO frame."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    sectors = {}
    for name, prompt in [("north", PROMPT_NORTH), ("south", PROMPT_SOUTH)]:
        print(f"🗺️ Generating {name}...")
        images = await image_gen.generate_images(prompt=prompt, model="gpt-image-1", number_of_images=1)
        if images:
            path = f"/app/frontend/assets/images/retourfrance-map-{name}.png"
            with open(path, "wb") as f:
                f.write(images[0])
            img = Image.open(path).resize((1024, 1536), Image.LANCZOS)
            img.save(path)
            sectors[name] = img
            print(f"  ✓ {name}: {img.size}")
    
    if len(sectors) == 2:
        composite = Image.new('RGB', (1024, 3072))
        composite.paste(sectors['north'], (0, 0))
        composite.paste(sectors['south'], (0, 1536))
        composite.save("/app/frontend/assets/images/retourfrance-map.png")
        print(f"\n✓ Composite: {composite.size}")
        
        # Generate masks with adjusted thresholds
        print("\n🗺️ Land masks:")
        for name, img in sectors.items():
            arr = np.array(img)
            mask_rows = []
            g = 50
            ch, cw = img.height // g, img.width // g
            for r in range(g):
                s = ""
                for c in range(g):
                    cell = arr[r*ch:(r+1)*ch, c*cw:(c+1)*cw]
                    rm = float(cell[:,:,0].mean())
                    gm = float(cell[:,:,1].mean())
                    bm = float(cell[:,:,2].mean())
                    # Land: warm beige (R highest, R > G > B, R-B > 25)
                    # Sea: teal (G highest or close, B close to G, R lower)
                    is_land = (rm - bm > 15) and (rm > 145) and (rm > gm)
                    s += "1" if is_land else "0"
                mask_rows.append(s)
            
            land = sum(r.count('1') for r in mask_rows)
            print(f"\nretourfrance_{name}: {land}/2500 ({100*land/2500:.1f}%)")
            for r in mask_rows:
                print(f'    "{r}",')
    
    print("\n✅ Done!")

asyncio.run(main())
