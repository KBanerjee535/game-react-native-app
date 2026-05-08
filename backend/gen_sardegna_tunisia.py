"""
Generate Sardegna south sector: Tunisia (north coast).
Replace current south Sardinia with Tunisia.
"""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from PIL import Image
import numpy as np

PROMPT = """A vintage parchment-style cartographic map seen from directly above, PORTRAIT format.

This map shows the NORTHERN COAST OF TUNISIA from above:

- TOP 30%: Mediterranean Sea (dark muted teal #7A9E8E), open water
- BOTTOM 70%: Tunisia landmass (warm sandy beige #D2B48C)
  - The Tunisian coast runs horizontally across the middle of the image
  - Cap Bon peninsula sticks out to the UPPER RIGHT (northeast) as a curved hook into the sea
  - Gulf of Tunis is a concave bay to the LEFT of Cap Bon
  - The city of Tunis would be at the inner edge of the gulf
  - West of the gulf: flat coastal plain
  - The land extends to the bottom and left edges
  - The land is relatively flat with subtle parchment texture

COLORS: Land = warm sandy beige #D2B48C with aged parchment cracks. Sea = dark muted teal #7A9E8E. Maximum contrast between land and sea.
STYLE: Flat vintage aviation map on aged parchment. NO text, NO labels, NO borders, NO compass, NO frame, NO decorations."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    print("Generating Tunisia south sector for Sardegna...")
    images = await image_gen.generate_images(prompt=PROMPT, model="gpt-image-1", number_of_images=1)
    
    if not images:
        print("ERROR: No image generated!")
        return
    
    path = "/app/frontend/assets/images/sardegna-map-south.png"
    with open(path, "wb") as f:
        f.write(images[0])
    
    img = Image.open(path)
    img = img.resize((1024, 1536), Image.LANCZOS)
    img.save(path)
    print(f"Saved: {img.size}")
    
    # Rebuild composite (north + center + south)
    north = Image.open("/app/frontend/assets/images/sardegna-map-north.png")
    center = Image.open("/app/frontend/assets/images/sardegna-map-center.png")
    south = img
    
    composite = Image.new('RGB', (1024, 1536 * 3))
    composite.paste(north.resize((1024, 1536), Image.LANCZOS), (0, 0))
    composite.paste(center.resize((1024, 1536), Image.LANCZOS), (0, 1536))
    composite.paste(south, (0, 1536 * 2))
    composite.save("/app/frontend/assets/images/sardegna-map.png")
    print(f"Composite: {composite.size}")
    
    # Generate land mask for new south sector
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
    print(f"\nsardegna_south: {land}/2500 ({100*land/2500:.1f}% land)")
    for r in rows:
        print(f'    "{r}",')
    
    print("\n=== DONE ===")

asyncio.run(main())
