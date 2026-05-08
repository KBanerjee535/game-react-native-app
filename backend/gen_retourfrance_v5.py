"""
Generate RETOUR FRANCE v5: TWO separate images, one per sector.
- North sector: France (from English Channel to Pyrenees)
- South sector: Spain + northern Algeria (from Pyrenees to Atlas mountains)
Each image is 1024x1536, combined into 1024x3072 composite.
NO STRETCHING needed - each sector fills its half naturally.
"""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from PIL import Image
import numpy as np

PROMPT_NORTH = """A vintage parchment-style cartographic map seen from directly above, PORTRAIT format.

This map shows FRANCE seen from above:

- At the VERY TOP: the English Channel (La Manche) = a horizontal strip of dark teal water
- FRANCE occupies 80% of the image as a large hexagonal landmass in warm sandy beige
- LEFT side: Atlantic Ocean (dark muted teal)
- Brittany peninsula sticks out to the left into the Atlantic
- Bay of Biscay = curved teal water area at bottom-left
- RIGHT side: eastern France borders (Alps, Jura) = beige land continuing to edge
- BOTTOM: the Pyrenees mountains = a horizontal darker line, with NORTHERN SPAIN visible as beige land at the very bottom edge
- The Mediterranean Sea is visible at the bottom-right corner as teal water

COLORS: Land = warm sandy beige #D2B48C with parchment cracks. Sea = dark muted teal #7A9E8E. Maximum contrast.
STYLE: Flat vintage aviation map on aged parchment. NO text, NO labels, NO borders, NO compass, NO frame."""

PROMPT_SOUTH = """A vintage parchment-style cartographic map seen from directly above, PORTRAIT format.

This map shows SPAIN and NORTHERN ALGERIA from above:

- At the VERY TOP: continuation of the Pyrenees = thin darker horizontal line, with the Bay of Biscay on the left as dark teal water
- SPAIN (Iberian Peninsula) occupies the top 65% of the image
  - Spain is a large BLOCKY rectangular landmass in warm sandy beige
  - Portugal = thin strip on the far left coast
  - Mediterranean Sea = dark teal on the RIGHT side
  - Balearic Islands = 2-3 small beige dots in the Mediterranean
  - The Spanish coast curves from northeast to southeast

- In the MIDDLE: Strait of Gibraltar = a thin horizontal strip of dark teal water (about 3% of image height)

- BOTTOM 30%: NORTHERN ALGERIA
  - Wide continuous beige landmass stretching across the full width
  - The Algerian coast faces the Mediterranean (teal) at top of this section
  - Atlas mountains region = subtle texture in the beige land
  - This land extends to the very bottom edge

COLORS: Land = warm sandy beige #D2B48C with parchment cracks. Sea = dark muted teal #7A9E8E. Maximum contrast.
STYLE: Flat vintage aviation map on aged parchment. NO text, NO labels, NO borders, NO compass, NO frame."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    sectors = {}
    for name, prompt in [("north", PROMPT_NORTH), ("south", PROMPT_SOUTH)]:
        print(f"Generating {name} sector...")
        images = await image_gen.generate_images(prompt=prompt, model="gpt-image-1", number_of_images=1)
        if not images:
            print(f"ERROR: No {name} image!")
            return
        path = f"/app/frontend/assets/images/retourfrance-map-{name}.png"
        with open(path, "wb") as f:
            f.write(images[0])
        img = Image.open(path)
        # Ensure exact target size
        img = img.resize((1024, 1536), Image.LANCZOS)
        img.save(path)
        sectors[name] = img
        print(f"  {name}: {img.size}")
    
    # Combine into composite (no stretching!)
    composite = Image.new('RGB', (1024, 3072))
    composite.paste(sectors['north'], (0, 0))
    composite.paste(sectors['south'], (0, 1536))
    composite.save("/app/frontend/assets/images/retourfrance-map.png")
    print(f"\nComposite: {composite.size}")
    
    # Generate land masks
    for name, img in sectors.items():
        arr = np.array(img)
        h, w = arr.shape[:2]
        GRID = 50
        ch, cw = h // GRID, w // GRID
        rows = []
        for r in range(GRID):
            s = ""
            for c in range(GRID):
                cell = arr[r*ch:(r+1)*ch, c*cw:(c+1)*cw]
                rm = float(cell[:,:,0].mean())
                gm = float(cell[:,:,1].mean())
                bm = float(cell[:,:,2].mean())
                brightness = (rm + gm + bm) / 3
                is_land = (rm - gm > 3) and (brightness > 148) and (rm > 152)
                s += "1" if is_land else "0"
            rows.append(s)
        
        land = sum(r.count('1') for r in rows)
        print(f"\nretourfrance_{name}: {land}/2500 ({100*land/2500:.1f}% land)")
        for r in rows:
            print(f'    "{r}",')
    
    print("\n=== DONE ===")

asyncio.run(main())
