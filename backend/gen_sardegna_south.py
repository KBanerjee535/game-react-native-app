"""Regenerate only the SOUTH sector map for Sardegna with wider view."""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

PROMPT_SOUTH = """Top-down vintage parchment map showing the WESTERN MEDITERRANEAN between SARDINIA and NORTH AFRICA. PORTRAIT orientation.

LAYOUT (CRITICAL):
- TOP 15%: The southern tip of SARDINIA — just the very bottom coast of the island (Cagliari area). Positioned center-left.
- RIGHT SIDE (20-30% from right): The ITALIAN PENINSULA — the southern part of Italy's "boot" shape, including Calabria and the heel. Coast running vertically.
- CENTER: Large open Mediterranean Sea — clearly teal/blue-green water.
- CENTER-RIGHT: The island of SICILY — a triangular island visible between Italy and Tunisia. Clearly separated from both by sea.
- BOTTOM 20%: The northern coast of TUNISIA/NORTH AFRICA — a wide band of land at the bottom, spanning the left and center portions. The coast runs LEFT to RIGHT.
- The sea dominates the center of the image (~60% water, 40% land total).

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture with slight relief shading. NO green.
OCEAN/SEA COLOR: muted teal/blue-green, clearly distinct from land.
ABSOLUTELY NO: text, labels, borders, compass rose, decorations, legend, grid lines, political boundaries, yellow border frame.
Style: 1920s aviator navigation chart on aged parchment, Aéropostale route map style."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    print("Generating Sardegna SOUTH map (wide view)...")
    try:
        images = await image_gen.generate_images(
            prompt=PROMPT_SOUTH,
            model="gpt-image-1",
            number_of_images=1
        )
        if images and len(images) > 0:
            path = "/app/frontend/assets/images/sardegna-map-south.png"
            with open(path, "wb") as f:
                f.write(images[0])
            print(f"✓ Sardegna SOUTH map saved to {path}")
        else:
            print("✗ No image generated")
    except Exception as e:
        print(f"✗ Error: {e}")

asyncio.run(main())
