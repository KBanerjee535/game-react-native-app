"""Regenerate SOUTH sector map for Sardegna - focused on south Sardinia + Tunisia only."""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

PROMPT_SOUTH = """Top-down vintage parchment map showing the sea between SOUTHERN SARDINIA and NORTHERN TUNISIA. PORTRAIT orientation.

LAYOUT (CRITICAL):
- TOP 20%: The southern tip of SARDINIA — the Cagliari/Sulcis region. A wide piece of land visible at the TOP-CENTER of the image, with a bay (Gulf of Cagliari) visible. The coast curves from left to right.
- MIDDLE 55%: Open Mediterranean Sea — large expanse of teal/blue-green water. NO islands, NO other landmasses. Just open sea between Sardinia and Tunisia.
- BOTTOM 25%: The northern coast of TUNISIA — a wide band of land at the bottom spanning most of the width. The coast is irregular with the Cap Bon peninsula visible on the right side as a small promontory pointing upward. A small island may be visible near the coast.
- NO Italy, NO Sicily, NO Corsica visible. ONLY southern Sardinia at top and Tunisia at bottom.

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture with slight relief shading. NO green.
OCEAN/SEA COLOR: muted teal/blue-green, clearly distinct from land.
ABSOLUTELY NO: text, labels, borders, compass rose, decorations, legend, grid lines, political boundaries, yellow border frame.
Style: 1920s aviator navigation chart on aged parchment, Aéropostale route map style."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    print("Generating Sardegna SOUTH map (Sardinia-Tunisia focus)...")
    try:
        images = await image_gen.generate_images(
            prompt=PROMPT_SOUTH,
            model="gpt-image-1",
            number_of_images=1
        )
        if images and len(images) > 0:
            with open("/app/frontend/assets/images/sardegna-map-south.png", "wb") as f:
                f.write(images[0])
            print("✓ Saved")
        else:
            print("✗ No image")
    except Exception as e:
        print(f"✗ Error: {e}")

asyncio.run(main())
