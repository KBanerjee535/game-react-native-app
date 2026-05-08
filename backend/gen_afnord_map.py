"""Generate 3 maps for North Africa mission: Morocco, Algeria, Tunisia."""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

PROMPT_LEFT = """Top-down vintage parchment map of MOROCCO. PORTRAIT orientation.

LAYOUT:
- TOP 15%: Southern tip of SPAIN and Strait of GIBRALTAR visible at top-left. A narrow sea channel.
- TOP 25%: MEDITERRANEAN SEA along northern coast of Morocco.
- CENTER/BOTTOM 75%: MOROCCO land mass. Atlantic coast on the LEFT edge. The land extends to the RIGHT edge (continues into Algeria in next sector). The land extends to the bottom edge. The RIF and ATLAS mountain ranges shown with subtle relief shading. Rabat area on the Atlantic coast (left side).

CRITICAL: Land MUST touch the RIGHT edge of the image (it continues into Algeria). Sea is only at TOP and LEFT (Atlantic coast). Bottom is all land.

LAND: warm parchment beige (#DFC89A to #E8D5AD), aged paper texture, subtle mountain relief. NO green.
SEA: muted teal (#8BA89B to #9DB8A8). NO text, NO labels, NO borders, NO decorations, NO compass."""

PROMPT_CENTER = """Top-down vintage parchment map of ALGERIA. PORTRAIT orientation.

LAYOUT:
- TOP 20%: MEDITERRANEAN SEA along the northern coast of Algeria. Irregular coastline with bays.
- CENTER/BOTTOM 80%: ALGERIA land mass. The TELL ATLAS mountains along the coast (subtle relief). Vast interior land (steppe/desert). Land extends to ALL edges: LEFT (continues from Morocco), RIGHT (continues into Tunisia), BOTTOM (Sahara).

CRITICAL: Land touches LEFT, RIGHT, and BOTTOM edges. Sea is ONLY at the TOP.

LAND: warm parchment beige (#DFC89A to #E8D5AD), aged paper texture, subtle relief. NO green.
SEA: muted teal (#8BA89B to #9DB8A8). NO text, NO labels, NO borders, NO decorations, NO compass."""

PROMPT_RIGHT = """Top-down vintage parchment map of TUNISIA and eastern Algeria. PORTRAIT orientation.

LAYOUT:
- TOP 20%: MEDITERRANEAN SEA along the northern coast. The Cap Bon peninsula points northeast into the sea. The Gulf of Tunis is visible.
- RIGHT SIDE: MEDITERRANEAN SEA along the eastern coast of Tunisia. The coast runs roughly north-south.
- LEFT/CENTER/BOTTOM: TUNISIA and eastern ALGERIA land mass. Land extends to LEFT edge (continues from Algeria), BOTTOM edge (Sahara). Interior is flat steppe/desert.

CRITICAL: Land touches LEFT and BOTTOM edges. Sea is at TOP and RIGHT.

LAND: warm parchment beige (#DFC89A to #E8D5AD), aged paper texture, subtle relief. NO green.
SEA: muted teal (#8BA89B to #9DB8A8). NO text, NO labels, NO borders, NO decorations, NO compass."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    for name, prompt, filename in [
        ("LEFT (Morocco)", PROMPT_LEFT, "afnord-map-left.png"),
        ("CENTER (Algeria)", PROMPT_CENTER, "afnord-map-center.png"),
        ("RIGHT (Tunisia)", PROMPT_RIGHT, "afnord-map-right.png"),
    ]:
        print(f"Generating {name}...")
        try:
            images = await image_gen.generate_images(prompt=prompt, model="gpt-image-1", number_of_images=1)
            if images and len(images) > 0:
                path = f"/app/frontend/assets/images/{filename}"
                with open(path, "wb") as f:
                    f.write(images[0])
                from PIL import Image
                img = Image.open(path)
                print(f"  ✓ {name}: {img.size}")
                img.resize((1024, 1536), Image.LANCZOS).save(path)
        except Exception as e:
            print(f"  ✗ {name}: {e}")
    
    # Build HORIZONTAL composite (3072 x 1536)
    from PIL import Image
    left = Image.open("/app/frontend/assets/images/afnord-map-left.png")
    center = Image.open("/app/frontend/assets/images/afnord-map-center.png")
    right = Image.open("/app/frontend/assets/images/afnord-map-right.png")
    comp = Image.new('RGB', (3072, 1536))
    comp.paste(left, (0, 0))
    comp.paste(center, (1024, 0))
    comp.paste(right, (2048, 0))
    comp.save("/app/frontend/assets/images/afnord-map.png")
    print(f"\n✓ Horizontal composite: {comp.size}")

asyncio.run(main())
