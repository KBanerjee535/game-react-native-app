"""
Generate new ATLANTIQUE map - more zoomed out to show more land area.
Both Africa and South America should occupy more of the image.
"""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from PIL import Image
import numpy as np

PROMPT = """A vintage parchment-style cartographic map seen from directly above, PORTRAIT format (taller than wide).

This map shows a ZOOMED OUT view of the ATLANTIC OCEAN between South America and Africa:

LEFT SIDE - SOUTH AMERICA (occupies 35% of image width):
- The entire eastern coast of Brazil is visible, from the Amazon delta in the north to Uruguay in the south
- Brazil's characteristic bulge (Natal/Recife) is prominent in the upper-left area
- The land extends well inland showing a large beige landmass
- The coastline is clearly defined with darker edges

RIGHT SIDE - AFRICA (occupies 35% of image width):
- The entire western coast of Africa from Mauritania/Senegal in the north to Angola/Namibia in the south
- The characteristic bulge of West Africa (Guinea, Sierra Leone, Ivory Coast, Ghana, Nigeria) is prominent
- The land extends well inland showing a large beige landmass
- The coastline is clearly defined

CENTER - ATLANTIC OCEAN (occupies 30% of image width):
- Dark muted teal water (#7A9E8E) between the two continents
- A few small islands visible (Cape Verde, Ascension Island)
- The ocean should be NARROWER than the current map - more land, less sea

CRITICAL: The land areas must be LARGE - each continent should show substantial inland territory, not just thin coastal strips. The goal is to have MORE LAND AREA for placing game destinations.

COLORS:
- LAND: warm sandy beige (#D2B48C) with aged parchment cracks and texture
- SEA: dark muted teal (#7A9E8E), clearly darker and greener than land
- Maximum contrast between land and sea

STYLE: Flat vintage aviation map on aged parchment. NO text, NO labels, NO borders, NO compass, NO frame, NO decorations."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    print("Generating new ATLANTIQUE map (more zoomed out)...")
    images = await image_gen.generate_images(prompt=PROMPT, model="gpt-image-1", number_of_images=1)
    
    if not images:
        print("ERROR: No image generated!")
        return
    
    path = "/app/frontend/assets/images/atlantique-map.png"
    with open(path, "wb") as f:
        f.write(images[0])
    
    img = Image.open(path)
    img = img.resize((1024, 1536), Image.LANCZOS)
    img.save(path)
    print(f"Saved: {img.size}")
    
    # Generate land mask
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
    print(f"\natlantique mask: {land}/2500 ({100*land/2500:.1f}% land)")
    for r in rows:
        print(f'    "{r}",')
    
    print("\n=== DONE ===")

asyncio.run(main())
