"""Generate 3 Sardegna sectors: ONLY Sardinia island, no Corsica, no Tunisia."""
import asyncio
import os
import numpy as np
from dotenv import load_dotenv
load_dotenv()
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from PIL import Image

PROMPT_NORTH = """Top-down vintage parchment map showing the NORTHERN THIRD of SARDINIA island. PORTRAIT orientation.

The northern part of Sardinia fills the image:
- The northern coastline (Gallura, Costa Smeralda, Olbia) runs across the TOP portion with deep bays and rocky inlets
- The island body extends from the top edge downward, filling 55-65% of the image width, centered
- The island continues BEYOND the bottom edge (cut off — the center section continues below)
- Sea visible on left and right sides
- Interior shows subtle mountain relief texture

The island should look WIDE and substantial. NO other islands, NO Corsica, NO mainland.

LAND: warm parchment beige (#D4B896 to #E8D5B5), subtle mountain texture. NO green.
SEA: muted teal (#7A9A8A to #8DAD9C).
NO text, labels, borders, compass, decorations, frame.
Style: 1920s aviator parchment chart."""

PROMPT_CENTER = """Top-down vintage parchment map showing the CENTRAL THIRD of SARDINIA island. PORTRAIT orientation.

The central body of Sardinia fills the image:
- The island extends from TOP edge to BOTTOM edge (both edges cut off — it continues above and below)
- The island takes 50-60% of image width, CENTERED
- Western coast: Gulf of Oristano (large bay indent on the left), Alghero coast
- Eastern coast: Tyrrhenian coast, relatively straight
- Central mountain spine (Gennargentu massif) visible as subtle relief running north-south
- Sea visible on left and right sides

The island should look WIDE and substantial, like a thick central body.

LAND: warm parchment beige (#D4B896 to #E8D5B5), subtle mountain relief. NO green.
SEA: muted teal (#7A9A8A to #8DAD9C).
NO text, labels, borders, compass, decorations, frame.
Style: 1920s aviator parchment chart."""

PROMPT_SOUTH = """Top-down vintage parchment map showing the SOUTHERN THIRD of SARDINIA island. PORTRAIT orientation.

The southern part of Sardinia fills the image:
- The island body enters from the TOP edge (continuing from the center section above)
- The island narrows toward its southern tip
- Gulf of Cagliari: a wide bay on the south-southeastern coast
- Sulcis-Iglesiente coast on the southwest with islands (Sant'Antioco, San Pietro)
- The southern tip of the island is visible in the lower portion
- Below the island tip: open sea
- Sea visible on left and right sides

The island should look WIDE at the top, gradually narrowing. NO Tunisia, NO other mainland.

LAND: warm parchment beige (#D4B896 to #E8D5B5), subtle relief. NO green.
SEA: muted teal (#7A9A8A to #8DAD9C).
NO text, labels, borders, compass, decorations, frame.
Style: 1920s aviator parchment chart."""

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
            img = Image.open(path).resize((1024, 1536), Image.LANCZOS)
            img.save(path)
            sectors[name] = img
            print(f"  ✓ {name}: {img.size}")
    
    if len(sectors) == 3:
        composite = Image.new('RGB', (1024, 4608))
        composite.paste(sectors['north'], (0, 0))
        composite.paste(sectors['center'], (0, 1536))
        composite.paste(sectors['south'], (0, 3072))
        composite.save("/app/frontend/assets/images/sardegna-map.png")
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
            print(f"\nsardegna_{name}: {land}/2500 ({100*land/2500:.1f}%)")
            for r in rows:
                print(f'    "{r}",')
    
    print("\n✅ Done!")

asyncio.run(main())
