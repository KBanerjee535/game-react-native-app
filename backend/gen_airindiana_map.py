"""Generate the AIR INDIANA Indian Ocean map."""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

PROMPT = """Top-down vintage parchment map of the INDIAN OCEAN region. PORTRAIT orientation.

LAYOUT (CRITICAL):
- LEFT SIDE: EAST COAST of AFRICA from SOMALIA / HORN OF AFRICA at top, down through KENYA, TANZANIA, MOZAMBIQUE, and SOUTH AFRICA at the bottom-left. MADAGASCAR clearly visible as a large island just off the African southeast coast.
- TOP: SOUTHERN ARABIA (YEMEN, OMAN), PERSIAN GULF, and PAKISTAN/INDIA peninsula extending downward into the ocean (Sri Lanka tip).
- RIGHT SIDE: SOUTHEAST ASIA — MYANMAR/THAILAND, MALAY PENINSULA, SUMATRA, JAVA, and AUSTRALIA (west and northwest coast) on the lower-right, with a portion of WESTERN AUSTRALIA visible at bottom-right.
- CENTER: vast INDIAN OCEAN with small island chains — MALDIVES (mid-north, near India), SEYCHELLES (north of Madagascar), MAURITIUS / RÉUNION (east of Madagascar), and the CHAGOS archipelago.

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture with subtle relief shading. NO green.
OCEAN/SEA COLOR: muted teal/blue-green, clearly distinct from land.
ABSOLUTELY NO: text, labels, borders, compass rose, decorations, legend, grid lines, political boundaries.
Style: 1920s aviator navigation chart on aged parchment, Aeropostale Africa-Asia route map style — same look as historical Indian Ocean flight charts."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    print("Generating AIR INDIANA map...")
    try:
        images = await image_gen.generate_images(prompt=PROMPT, model="gpt-image-1", number_of_images=1)
        if images:
            with open("/app/frontend/assets/images/airindiana-map.png", "wb") as f:
                f.write(images[0])
            print("OK saved")
    except Exception as e:
        print(f"ERR: {e}")

asyncio.run(main())
