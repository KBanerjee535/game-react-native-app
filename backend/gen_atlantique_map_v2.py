"""
Generate ATLANTIQUE map v2 - realistic distance between Africa and South America.
The Atlantic Ocean should be proportionally wide between the two continents.
"""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from PIL import Image
import numpy as np

PROMPT = """A vintage parchment-style cartographic map seen from directly above, PORTRAIT format (taller than wide).

This map shows the ATLANTIC OCEAN between South America and Africa with REALISTIC PROPORTIONS:

LEFT SIDE - EASTERN COAST OF SOUTH AMERICA (~20% of image width):
- The coast of Brazil is visible on the far left, from the Amazon in the north to southern Brazil
- Brazil's characteristic bulge (Natal/Recife area) protrudes to the right in the upper portion
- The land extends to the left edge of the image
- Only the eastern coastal strip of Brazil is visible (this is realistic - most of the continent is off-screen to the left)

CENTER - ATLANTIC OCEAN (~50% of image width):
- A WIDE expanse of dark muted teal water
- The ocean occupies the majority of the image (this is geographically accurate - the Atlantic is vast)
- A few small islands: Cape Verde islands (small dots near Africa, upper right area)
- The ocean should feel immense and expansive

RIGHT SIDE - WESTERN COAST OF AFRICA (~30% of image width):
- The West African coast from Mauritania/Senegal at the top to Congo/Angola at the bottom
- The characteristic bulge of West Africa (Gulf of Guinea) is visible
- Africa's landmass is broader than Brazil's visible portion
- The land extends to the right edge of the image

IMPORTANT: The distance between the two continents must look REALISTIC - the ocean is MUCH wider than either visible landmass. This is how it looks on a real map.

COLORS:
- LAND: warm sandy beige (#D2B48C) with aged parchment cracks and texture
- SEA: dark muted teal (#7A9E8E), clearly darker and greener than land
- Coastlines clearly defined with darker edges

STYLE: Flat vintage aviation map on aged parchment. NO text, NO labels, NO borders, NO compass, NO frame."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    print("Generating ATLANTIQUE map v2 (realistic proportions)...")
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
