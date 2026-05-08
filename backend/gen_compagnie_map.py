"""Generate the COMPAGNIE Atlantic map: South America + East NA + West Europe/Africa."""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

PROMPT = """Top-down vintage parchment map of the ATLANTIC OCEAN region. PORTRAIT orientation.

LAYOUT (CRITICAL):
- The image shows the entire ATLANTIC OCEAN with surrounding landmasses on left, top-left, top-right, and right.
- LEFT SIDE: ENTIRE SOUTH AMERICA from Colombia/Venezuela at top down to Tierra del Fuego at bottom — full continent visible. Plus the EAST COAST of NORTH AMERICA at the top-left (Florida, US East Coast, Eastern Canada/Newfoundland).
- RIGHT SIDE: WEST COAST of EUROPE (Iberian Peninsula — Portugal/Spain — and southwestern France) at top-right. WEST COAST of AFRICA (from Morocco down to Senegal, Guinea, Liberia, Ivory Coast, Gulf of Guinea, ending around Angola/Namibia at the bottom-right).
- CENTER: vast ATLANTIC OCEAN, occupying about 40-50% of the image width.
- The Caribbean Sea, Gulf of Mexico, and Mediterranean entrance at top should be visible.

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture with relief shading for mountains (Andes prominent on west South America). NO green.
OCEAN/SEA COLOR: muted teal/blue-green, clearly distinct from land.
ABSOLUTELY NO: text, labels, borders, compass rose, decorations, legend, grid lines, political boundaries.
Style: 1920s aviator navigation chart on aged parchment, Aéropostale route map style — same look as historical Lindbergh/Saint-Exupéry transatlantic charts."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)

    print("Generating ATLANTIC COMPAGNIE map...")
    try:
        images = await image_gen.generate_images(
            prompt=PROMPT,
            model="gpt-image-1",
            number_of_images=1
        )
        if images and len(images) > 0:
            with open("/app/frontend/assets/images/compagnie-map.png", "wb") as f:
                f.write(images[0])
            print("✓ COMPAGNIE map saved")
        else:
            print("✗ No image generated")
    except Exception as e:
        print(f"✗ Error: {e}")

asyncio.run(main())
