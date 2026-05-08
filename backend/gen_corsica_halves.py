"""Generate the Corsica NORTH HALF and SOUTH HALF maps in vintage parchment style."""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

PROMPT_NORTH = """Top-down vintage parchment map showing the NORTHERN HALF of CORSICA island only. PORTRAIT orientation.

LAYOUT (CRITICAL):
- The image shows ONLY the northern half of Corsica — from CAP CORSE at the very top down to the central area near Corte. The southern half (Ajaccio, Bonifacio) is NOT visible, it extends beyond the bottom edge.
- CAP CORSE peninsula at TOP-CENTER: a thin elongated finger of land pointing UP, occupies roughly the top 18% of the image, horizontally centered.
- Below Cap Corse: the GULF OF SAINT-FLORENT cuts in from the WEST coast.
- Northern body widens out: BASTIA on the east coast (right side), L'ÎLE-ROUSSE and CALVI on the west coast (left side, with the GOLFE DE CALVI as a clear indent).
- Central body extends to the bottom edge of the image (continues into south half not shown). The land is wide here, taking 60-70% of the image width.
- Mountain spine running NORTH-SOUTH through the center (shaded relief).
- Sea (teal/blue-green) surrounds the island on east, west, and top. NO land visible on left/right edges, NO Italy, NO French coast, NO Sardinia.

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture with relief shading for mountains. NO green.
OCEAN/SEA COLOR: muted teal/blue-green, clearly distinct from land.
ABSOLUTELY NO: text, labels, borders, compass rose, decorations, legend, grid lines, political boundaries.
Style: 1920s aviator navigation chart on aged parchment, Aéropostale route map style."""

PROMPT_SOUTH = """Top-down vintage parchment map showing the SOUTHERN HALF of CORSICA island only. PORTRAIT orientation.

LAYOUT (CRITICAL):
- The image shows ONLY the southern half of Corsica — from the central area (Corte, Ajaccio) down to BONIFACIO at the very bottom. The northern half (Cap Corse, Bastia, Calvi) is NOT visible, it extends beyond the top edge.
- TOP of the image: wide central body of Corsica spanning 60-70% of the width (continuation from the north half).
- Western coast (left side): the GULF OF AJACCIO carves in deeply, then GOLFE DE VALINCO, then GOLFE DE FIGARI further south.
- Eastern coast (right side): flatter and more regular, with PORTO-VECCHIO bay near the bottom-right.
- Body tapers gradually toward the south.
- BONIFACIO at the BOTTOM-CENTER: the southern tip of Corsica, narrow promontory pointing DOWN.
- Below Bonifacio: open sea to the bottom edge. NO Sardinia, NO other landmass.
- Mountain spine running NORTH-SOUTH through the center (shaded relief).
- Sea (teal/blue-green) surrounds the island on east, west, and bottom. NO land on left/right edges.

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture with relief shading for mountains. NO green.
OCEAN/SEA COLOR: muted teal/blue-green, clearly distinct from land.
ABSOLUTELY NO: text, labels, borders, compass rose, decorations, legend, grid lines, political boundaries.
Style: 1920s aviator navigation chart on aged parchment, Aéropostale route map style."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)

    print("Generating Corsica NORTH HALF map...")
    try:
        images = await image_gen.generate_images(
            prompt=PROMPT_NORTH,
            model="gpt-image-1",
            number_of_images=1
        )
        if images and len(images) > 0:
            with open("/app/frontend/assets/images/corsica-map-north.png", "wb") as f:
                f.write(images[0])
            print("✓ Corsica NORTH HALF saved")
        else:
            print("✗ No NORTH image generated")
    except Exception as e:
        print(f"✗ NORTH Error: {e}")

    print("Generating Corsica SOUTH HALF map...")
    try:
        images = await image_gen.generate_images(
            prompt=PROMPT_SOUTH,
            model="gpt-image-1",
            number_of_images=1
        )
        if images and len(images) > 0:
            with open("/app/frontend/assets/images/corsica-map-south.png", "wb") as f:
                f.write(images[0])
            print("✓ Corsica SOUTH HALF saved")
        else:
            print("✗ No SOUTH image generated")
    except Exception as e:
        print(f"✗ SOUTH Error: {e}")

asyncio.run(main())
