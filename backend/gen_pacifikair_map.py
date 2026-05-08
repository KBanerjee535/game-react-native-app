"""Generate the PACIFIKAIR Pacific ocean map."""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

PROMPT = """Top-down vintage parchment map of the PACIFIC OCEAN region. PORTRAIT orientation.

LAYOUT (CRITICAL):
- The image shows the entire PACIFIC OCEAN with surrounding landmasses on LEFT and RIGHT.
- LEFT SIDE (Asia/Oceania): EAST COAST of ASIA from KAMCHATKA at top, down through RUSSIAN FAR EAST, JAPAN (Honshu/Hokkaido), KOREA, EAST CHINA, TAIWAN, PHILIPPINES, INDONESIA, NEW GUINEA, and AUSTRALIA (northeast coast) in the lower-left, ending with NEW ZEALAND at the bottom-left corner.
- RIGHT SIDE (Americas): WEST COAST of NORTH AMERICA from ALASKA at top, down through CANADA (British Columbia), UNITED STATES (California), MEXICO, CENTRAL AMERICA, and WEST COAST of SOUTH AMERICA (Ecuador, Peru, Chile) down to TIERRA DEL FUEGO at the bottom-right.
- CENTER: vast PACIFIC OCEAN occupying about 45-55% of the image width. Include a few small ISLAND CHAINS — HAWAII roughly mid-north, French Polynesia/TAHITI mid-south, small Micronesian/Melanesian archipelagos scattered.
- Bering Strait visible at top between Alaska and Kamchatka.

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture with relief shading for mountains (Andes prominent on west South America, Rockies on USA, Japan Alps). NO green.
OCEAN/SEA COLOR: muted teal/blue-green, clearly distinct from land.
ABSOLUTELY NO: text, labels, borders, compass rose, decorations, legend, grid lines, political boundaries.
Style: 1920s aviator navigation chart on aged parchment, Aeropostale/Pan Am Clipper route map style — same look as historical transpacific flight charts."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)

    print("Generating PACIFIKAIR map...")
    try:
        images = await image_gen.generate_images(
            prompt=PROMPT,
            model="gpt-image-1",
            number_of_images=1
        )
        if images and len(images) > 0:
            with open("/app/frontend/assets/images/pacifikair-map.png", "wb") as f:
                f.write(images[0])
            print("OK PACIFIKAIR map saved")
        else:
            print("ERR No image generated")
    except Exception as e:
        print(f"ERR: {e}")

asyncio.run(main())
