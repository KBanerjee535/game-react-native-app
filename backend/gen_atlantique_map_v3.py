"""
Generate ATLANTIQUE map v3 - centered on midpoint of shortest Africa-South America distance.
The shortest crossing is Dakar (Senegal) ↔ Natal (Brazil), ~2850 km.
The map center should be the midpoint of this crossing.
"""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from PIL import Image
import numpy as np

PROMPT = """A vintage parchment-style cartographic map seen from directly above, PORTRAIT format.

This map is CENTERED on the MIDPOINT of the shortest Atlantic crossing between Africa and South America (the Dakar-Natal route).

The map shows:

LEFT - BRAZIL (eastern bulge):
- The characteristic northeastern bulge of Brazil is clearly visible on the left side
- The cities of Natal and Recife would be on this bulge
- The Brazilian coast curves from northwest to south
- The land (warm sandy beige) extends from center-left to the left edge
- Brazil occupies roughly the left 25-30% of the image

CENTER - MID-ATLANTIC:
- Dark muted teal ocean
- Cape Verde Islands = a few small beige dots slightly right of center, in the upper portion
- The ocean separates the two continents with realistic proportions

RIGHT - WEST AFRICA (Senegal/Guinea region):
- The western tip of Africa (Senegal, The Gambia, Guinea-Bissau) is visible on the right side
- The city of Dakar would be on the westernmost point of Africa
- The African coast descends from northwest to southeast
- Africa occupies roughly the right 25-30% of the image

IMPORTANT CENTERING: 
- The exact CENTER of the image (both horizontally and vertically) should be in the MIDDLE of the Atlantic Ocean, equidistant between the Brazilian bulge and the African coast
- Both continents should be roughly equally visible from the center

VERTICAL EXTENT:
- Top: shows ocean and parts of the upper coastlines (more northern parts)
- Middle: the narrowest crossing point (Natal ↔ Dakar latitude)
- Bottom: shows the coastlines continuing south (lower Brazil coast, Gulf of Guinea approaching)

COLORS:
- LAND: warm sandy beige (#D2B48C) with aged parchment cracks
- SEA: dark muted teal (#7A9E8E), clearly darker and greener than land
- Maximum contrast

STYLE: Flat vintage aviation map on aged parchment. NO text, NO labels, NO borders, NO compass, NO frame."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    print("Generating ATLANTIQUE map v3 (centered on midpoint Dakar-Natal)...")
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
