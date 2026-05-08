"""
Generate a dedicated RETOUR FRANCE map using GPT Image 1.
Single tall portrait image showing France, Spain, and North Africa.
Very specific geographic constraints to ensure accuracy.
"""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from PIL import Image
import numpy as np

PROMPT = """Create a bird's-eye view vintage parchment map in PORTRAIT orientation (taller than wide).

The map shows the WESTERN MEDITERRANEAN from above, covering exactly these regions from top to bottom:

TOP QUARTER - FRANCE:
- The English Channel (La Manche) as a narrow horizontal water strip at the very top
- France is a large HEXAGONAL landmass occupying most of the width
- Brittany peninsula sticks out to the LEFT (west)
- The Atlantic Ocean is on the LEFT side
- France's Mediterranean coast curves at bottom-right
- Paris would be in the upper-center of France

UPPER-MIDDLE - PYRENEES AND NORTHERN SPAIN:
- The Pyrenees mountains form a horizontal line separating France from Spain
- The Bay of Biscay (Golfe de Gascogne) is a large water area between France's west coast and Spain's north coast on the LEFT

LOWER-MIDDLE - SPAIN (IBERIAN PENINSULA):
- Spain is a large SQUARE/RECTANGULAR landmass
- Portugal is a thin strip on the far LEFT of Spain
- The Mediterranean Sea is on the RIGHT side of Spain
- Spain is WIDER than France
- The Balearic Islands (small dots) are in the sea to the RIGHT of Spain

BOTTOM QUARTER - STRAIT OF GIBRALTAR AND NORTH AFRICA:
- The Strait of Gibraltar is a VERY NARROW horizontal water gap between Spain and Africa (only a few pixels wide)
- Below the strait: Morocco and Algeria as a WIDE continuous landmass stretching across the full width
- The North African coast faces the Mediterranean
- North Africa extends to the bottom edge

CRITICAL COLOR RULES:
- ALL LAND = warm sandy beige (#D4B896) with subtle aged parchment texture and cracks
- ALL SEA/OCEAN = muted teal-green (#8BA89A) clearly distinguishable from land
- Coastlines should be clearly defined with a slight darker edge
- The contrast between land and sea must be VERY CLEAR

STYLE: Vintage aged parchment map. Warm sepia tones. Subtle paper texture and cracks on the land. NO text, NO labels, NO borders, NO compass rose, NO decorative frame, NO grid lines. Simple flat cartographic style like an old aviation map."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    print("Generating RETOUR FRANCE dedicated map...")
    images = await image_gen.generate_images(
        prompt=PROMPT,
        model="gpt-image-1",
        number_of_images=1
    )
    
    if not images:
        print("ERROR: No image generated!")
        return
    
    # Save raw generated image
    raw_path = "/app/frontend/assets/images/retourfrance-raw.png"
    with open(raw_path, "wb") as f:
        f.write(images[0])
    
    raw_img = Image.open(raw_path)
    print(f"Raw image: {raw_img.size}")
    
    # Resize to target: 1024 wide, 3072 tall (2 sectors of 1536 each)
    TARGET_W, TARGET_H_SINGLE = 1024, 1536
    
    # First resize to 1024 width, maintaining aspect ratio
    aspect = raw_img.height / raw_img.width
    new_h = int(TARGET_W * aspect)
    resized = raw_img.resize((TARGET_W, new_h), Image.LANCZOS)
    print(f"Resized: {resized.size}")
    
    # The image should be tall enough for 2 sectors
    # If not tall enough, pad. If too tall, crop to focus on the right area.
    target_total = TARGET_H_SINGLE * 2  # 3072
    
    if new_h >= target_total:
        # Crop to exact size
        composite = resized.crop((0, 0, TARGET_W, target_total))
    else:
        # Stretch to target height
        composite = resized.resize((TARGET_W, target_total), Image.LANCZOS)
    
    composite.save("/app/frontend/assets/images/retourfrance-map.png")
    print(f"Composite saved: {composite.size}")
    
    # Split into north and south sectors
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
                # Land: warm beige (R > G > B, higher brightness)
                # Sea: teal green (G relatively higher, lower overall brightness)
                brightness = (rm + gm + bm) / 3
                r_dominance = rm - gm  # land has R > G
                is_land = (r_dominance > 5) and (brightness > 155) and (rm > 160)
                s += "1" if is_land else "0"
            rows.append(s)
        
        land = sum(r.count('1') for r in rows)
        print(f"\nretourfrance_{name}: {land}/2500 ({100*land/2500:.1f}% land)")
        for r in rows:
            print(f'    "{r}",')
    
    print("\n=== DONE ===")

asyncio.run(main())
