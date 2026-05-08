"""Generate the ANTARTIKAIR Antarctica map and logo."""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

MAP_PROMPT = """Top-down vintage parchment map of ANTARCTICA and the SOUTHERN OCEAN. PORTRAIT orientation.

LAYOUT (CRITICAL):
- The image is centered on ANTARCTICA continent occupying about 40-50% of the frame in the lower-center.
- Surrounding the continent: the SOUTHERN OCEAN (cold, deep teal-blue).
- TOP EDGES of the map should show the southern tips of nearby continents:
  - TOP-LEFT: SOUTH AMERICA tip (Tierra del Fuego, Patagonia, Cape Horn)
  - TOP-CENTER: tip of AFRICA (Cape of Good Hope) and small islands
  - TOP-RIGHT: AUSTRALIA southern coast and TASMANIA, plus southern NEW ZEALAND tip
- Antarctic peninsula (curving up toward South America) clearly visible
- Surrounding islands: SOUTH GEORGIA, SOUTH SHETLAND, KERGUELEN, MACQUARIE etc.
- Show major bays: ROSS SEA, WEDDELL SEA carved into the continent

LAND COLOR: Antarctica should appear as warm parchment beige/white (#F0E8D0 to #E8DDB8), aged paper texture, NOT pure white. Subtle relief shading for mountain ranges (Trans-Antarctic Mountains).
OCEAN COLOR: muted teal/blue, clearly distinct from land.
ABSOLUTELY NO: text, labels, borders, compass rose, decorations, legend, grid lines.
Style: 1920s aviator polar navigation chart on aged parchment, vintage Antarctic exploration map style."""

LOGO_PROMPT = """Vintage 1920s aviator badge / logo for an airline named "ANTARTIKAIR".
Centered composition: stylized airplane tail / vertical stabilizer (similar to old Aeropostale or Pan-Am Clipper era), cream/parchment color (#E1CB9F).
Below the airplane tail: bold capital text "ANTARTIKAIR" in chunky sans-serif (BigNoodle / Big Caslon style), color cream/parchment.
Background: deep navy blue (#1A2F4A) with subtle aged paper texture.
A small snowflake or polar-star icon integrated.
NO other text, NO borders, NO frame.
Style: vintage airline logo, polar/Antarctic theme, aged elegant look."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    print("Generating ANTARTIKAIR map...")
    try:
        images = await image_gen.generate_images(prompt=MAP_PROMPT, model="gpt-image-1", number_of_images=1)
        if images:
            with open("/app/frontend/assets/images/antartikair-map.png", "wb") as f:
                f.write(images[0])
            print("OK map saved")
    except Exception as e:
        print(f"ERR map: {e}")

    print("Generating ANTARTIKAIR logo...")
    try:
        images = await image_gen.generate_images(prompt=LOGO_PROMPT, model="gpt-image-1", number_of_images=1)
        if images:
            with open("/app/frontend/assets/images/antartikair-logo.png", "wb") as f:
                f.write(images[0])
            print("OK logo saved")
    except Exception as e:
        print(f"ERR logo: {e}")

asyncio.run(main())
