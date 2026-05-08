"""
Generate RETOUR FRANCE map v4: France + Spain + Northern Algeria.
Very specific geography: from English Channel to northern Algeria.
"""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from PIL import Image
import numpy as np

PROMPT = """A vintage parchment-style cartographic map seen from directly above, PORTRAIT orientation (taller than wide, ratio 2:3).

This map shows EXACTLY these regions from TOP to BOTTOM:

1. TOP: ALL OF FRANCE
- The English Channel (narrow dark teal water strip) at the very top edge
- France is the LARGEST landmass, shaped like a hexagon
- Brittany peninsula on the west (LEFT) side
- Atlantic Ocean on the LEFT (dark teal water)
- The city of Paris would be upper-center
- France's south coast (Côte d'Azur) curves along the Mediterranean

2. MIDDLE: THE PYRENEES AND ALL OF SPAIN  
- A thin mountain chain (Pyrenees) separates France from Spain horizontally
- Bay of Biscay = dark teal water area to the LEFT between France and Spain
- Spain (Iberian Peninsula) is a large BLOCKY landmass, slightly wider than France
- Portugal is a thin strip on the far LEFT of Spain's coast
- Mediterranean Sea on the RIGHT of Spain
- Small Balearic Islands (2-3 tiny dots) in the Mediterranean RIGHT of Spain

3. BOTTOM: STRAIT OF GIBRALTAR AND NORTHERN ALGERIA
- Strait of Gibraltar = VERY thin dark teal water strip (5% of image height) separating Spain from Africa
- Below the strait: the northern coast of ALGERIA stretching across the full width
- Algeria's Atlas Mountains region = beige land with subtle texture
- This African landmass extends to the bottom edge of the image
- The African coast should be about 20% of the total image height

COLORS (CRITICAL - MUST FOLLOW):
- LAND: warm sandy beige (#D2B48C) with aged parchment cracks and texture
- SEA/OCEAN: dark muted teal (#7A9E8E), clearly DARKER and GREENER than land
- Coastlines: defined with thin darker brown edges
- Maximum contrast between land and sea

STYLE: Simple flat vintage aviation map on aged parchment. Warm sepia tones. Paper cracks. NO text, NO labels, NO city names, NO country borders, NO compass, NO frame, NO decorations, NO grid."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    print("Generating RETOUR FRANCE v4 map (France + Spain + N.Algeria)...")
    images = await image_gen.generate_images(
        prompt=PROMPT,
        model="gpt-image-1",
        number_of_images=1
    )
    
    if not images:
        print("ERROR: No image generated!")
        return
    
    raw_path = "/app/frontend/assets/images/retourfrance-raw-v4.png"
    with open(raw_path, "wb") as f:
        f.write(images[0])
    
    raw_img = Image.open(raw_path)
    print(f"Raw image: {raw_img.size}")
    
    TARGET_W = 1024
    TARGET_H_SINGLE = 1536
    target_total = TARGET_H_SINGLE * 2  # 3072
    
    # Resize to target composite size
    composite = raw_img.resize((TARGET_W, target_total), Image.LANCZOS)
    composite.save("/app/frontend/assets/images/retourfrance-map.png")
    print(f"Composite: {composite.size}")
    
    # Split into 2 sectors
    north = composite.crop((0, 0, TARGET_W, TARGET_H_SINGLE))
    south = composite.crop((0, TARGET_H_SINGLE, TARGET_W, target_total))
    north.save("/app/frontend/assets/images/retourfrance-map-north.png")
    south.save("/app/frontend/assets/images/retourfrance-map-south.png")
    print(f"North: {north.size}, South: {south.size}")
    
    # Generate land masks
    for name, img in [("north", north), ("south", south)]:
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
                r_dominance = rm - gm
                is_land = (r_dominance > 3) and (brightness > 150) and (rm > 155)
                s += "1" if is_land else "0"
            rows.append(s)
        
        land = sum(r.count('1') for r in rows)
        print(f"\nretourfrance_{name}: {land}/2500 ({100*land/2500:.1f}% land)")
        for r in rows:
            print(f'    "{r}",')
    
    print("\n=== DONE ===")

asyncio.run(main())
