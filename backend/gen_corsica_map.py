"""Generate the Corsica mission map in vintage parchment style."""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

PROMPT_NORTH = """Top-down vintage parchment map showing the FRENCH RIVIERA and northern tip of CORSICA. PORTRAIT orientation.

LAYOUT (CRITICAL):
- TOP 40%: The southern coast of France — the Côte d'Azur (Nice, Cannes, Monaco, Toulon). A wide band of land spanning the full width of the image, with the Maritime Alps foothills behind the coast. The coast runs LEFT to RIGHT.
- MIDDLE 20%: The Mediterranean Sea — open water, clearly teal/blue-green.
- BOTTOM 40%: The CAP CORSE peninsula emerging from the bottom. Cap Corse is a thin, elongated finger of land pointing UPWARD (north), HORIZONTALLY CENTERED in the image. It should be about 15-20% of the image width, positioned in the exact center. Only the top portion of Cap Corse is visible — the rest of Corsica extends beyond the bottom edge.

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture with slight relief shading. NO green.
OCEAN/SEA COLOR: muted teal/blue-green, clearly distinct from land.
ABSOLUTELY NO: text, labels, borders, compass rose, decorations, legend, grid lines, political boundaries.
Style: 1920s aviator navigation chart on aged parchment, Aéropostale route map style."""

PROMPT_SOUTH = """Top-down vintage parchment map showing the ENTIRE ISLAND OF CORSICA. PORTRAIT orientation.

LAYOUT (CRITICAL):
- The ISLAND OF CORSICA fills the center of the image, HORIZONTALLY and VERTICALLY CENTERED
- The island takes approximately 65-70% of the image height and 45-50% of the width
- CAP CORSE (thin northern peninsula) points UP at the top-center
- BONIFACIO (southern tip) at the bottom-center
- Western coast: rugged with gulfs (Porto, Ajaccio, Valinco, Figari)
- Eastern coast: flatter, more regular
- Central mountain spine visible north-south (Monte Cinto highest peak in upper third)
- The sea surrounds the entire island on all sides
- NO other landmass visible — NO Sardinia, NO Italy, NO French coast. Only Corsica surrounded by sea.

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture with relief shading for mountains. NO green.
OCEAN/SEA COLOR: muted teal/blue-green, clearly distinct from land.
ABSOLUTELY NO: text, labels, borders, compass rose, decorations, legend, grid lines, political boundaries.
Style: 1920s aviator navigation chart on aged parchment, Aéropostale route map style."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    # Générer la carte Nord
    print("Generating Corsica NORTH map...")
    try:
        images = await image_gen.generate_images(
            prompt=PROMPT_NORTH,
            model="gpt-image-1",
            number_of_images=1
        )
        if images and len(images) > 0:
            with open("/app/frontend/assets/images/corsica-map-north.png", "wb") as f:
                f.write(images[0])
            print("✓ Corsica NORTH map saved")
        else:
            print("✗ No NORTH image generated")
    except Exception as e:
        print(f"✗ NORTH Error: {e}")
    
    # Générer la carte Sud
    print("Generating Corsica SOUTH map...")
    try:
        images = await image_gen.generate_images(
            prompt=PROMPT_SOUTH,
            model="gpt-image-1",
            number_of_images=1
        )
        if images and len(images) > 0:
            with open("/app/frontend/assets/images/corsica-map-south.png", "wb") as f:
                f.write(images[0])
            print("✓ Corsica SOUTH map saved")
        else:
            print("✗ No SOUTH image generated")
    except Exception as e:
        print(f"✗ SOUTH Error: {e}")

asyncio.run(main())
