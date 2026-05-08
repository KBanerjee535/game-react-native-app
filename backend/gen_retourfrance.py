"""Generate 2 sector maps for RETOUR FRANCE: North Africa → Spain → France."""
import asyncio
import os
import numpy as np
from dotenv import load_dotenv
load_dotenv()
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from PIL import Image

PROMPT_NORTH = """Top-down vintage parchment navigation map. PORTRAIT orientation.

LAYOUT:
- TOP 50%: FRANCE. Western and central France visible. Brittany peninsula on the left, Atlantic coast running south. The Pyrenees mountain range at the very bottom. Channel coast and northern France at the top. France takes most of the width.
- BOTTOM 50%: NORTHERN SPAIN. The top of the Iberian peninsula visible. Cantabrian coast, Galicia on the left. The Pyrenees run across the top. Spain continues beyond the bottom edge.
- RIGHT edge: Bay of Biscay (sea) between France and Spain curves.

France and Spain should be WIDE and fill the image naturally. The Pyrenees separate them horizontally.

LAND: warm parchment beige (#D4B896 to #E8D5B5), subtle mountain relief. NO green.
SEA: muted teal (#7A9A8A to #8DAD9C).
NO text, labels, borders, compass, decorations, frame.
Style: 1920s aviator parchment chart."""

PROMPT_SOUTH = """Top-down vintage parchment navigation map. PORTRAIT orientation.

LAYOUT:
- TOP 45%: SPAIN - the main body of the Iberian peninsula continuing from top edge. The Meseta central plateau, Mediterranean coast on the right, Portugal on the left. Balearic islands (Mallorca, Menorca) visible as small islands on the right in the sea.
- MIDDLE 15%: STRAIT OF GIBRALTAR - narrow channel of sea between Spain (above) and Africa (below). Gibraltar visible.
- BOTTOM 40%: NORTH AFRICA coast. Morocco and Algeria coastline stretching across most of the width. The Rif mountains along the coast. Substantial amount of African land visible.

Spain should be WIDE (filling 70%+ of image width). The strait should be clearly visible.

LAND: warm parchment beige (#D4B896 to #E8D5B5), subtle mountain relief. NO green.
SEA: muted teal (#7A9A8A to #8DAD9C).
NO text, labels, borders, compass, decorations, frame.
Style: 1920s aviator parchment chart."""

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
        
        print("\n🗺️ Land masks:")
        for name, img in sectors.items():
            arr = np.array(img)
            rows = []
            g = 50
            ch, cw = img.height // g, img.width // g
            for r in range(g):
                s = ""
                for c in range(g):
                    cell = arr[r*ch:(r+1)*ch, c*cw:(c+1)*cw]
                    rm, bm = float(cell[:,:,0].mean()), float(cell[:,:,2].mean())
                    s += "1" if (rm - bm > 20 and rm > 150) else "0"
                rows.append(s)
            land = sum(r.count('1') for r in rows)
            print(f"\nretourfrance_{name}: {land}/2500 ({100*land/2500:.1f}%)")
            for r in rows:
                print(f'    "{r}",')
    
    print("\n✅ Done!")

asyncio.run(main())
