"""Generate the 3 Sardegna mission maps in vintage parchment style."""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

PROMPT_NORTH = """Top-down vintage parchment map showing the sea between SOUTHERN CORSICA and NORTHERN SARDINIA. PORTRAIT orientation.

LAYOUT (CRITICAL):
- TOP 25%: The southern tip of CORSICA — just the very bottom of the island, a rugged coast pointing downward. Positioned center-right in the image.
- MIDDLE 50%: Open Mediterranean Sea — clearly teal/blue-green water. The Strait of Bonifacio separating Corsica from Sardinia.
- BOTTOM 25%: The northern tip of SARDINIA — just the very top of the island (Costa Smeralda, Gallura region). Rocky coast emerging from the bottom edge.
- Small islands visible in the strait: Maddalena archipelago (tiny dots between the two islands).

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture with slight relief shading. NO green.
OCEAN/SEA COLOR: muted teal/blue-green, clearly distinct from land.
ABSOLUTELY NO: text, labels, borders, compass rose, decorations, legend, grid lines, political boundaries, yellow border frame.
Style: 1920s aviator navigation chart on aged parchment, Aéropostale route map style."""

PROMPT_CENTER = """Top-down vintage parchment map showing the ENTIRE ISLAND OF SARDINIA. PORTRAIT orientation.

LAYOUT (CRITICAL):
- The ISLAND OF SARDINIA fills the center of the image, HORIZONTALLY and VERTICALLY CENTERED
- The island takes approximately 70-75% of the image height and 50-55% of the width
- Northern coast (Gallura, Costa Smeralda) at the top
- Southern coast (Cagliari region) at the bottom
- Western coast: rugged with bays (Alghero, Oristano)
- Eastern coast: mountainous (Gennargentu range visible as spine)
- Central mountain spine running north-south
- The sea surrounds the entire island on all sides
- NO other landmass visible — NO Corsica, NO Italy, NO Tunisia. Only Sardinia surrounded by sea.

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture with relief shading for mountains. NO green.
OCEAN/SEA COLOR: muted teal/blue-green, clearly distinct from land.
ABSOLUTELY NO: text, labels, borders, compass rose, decorations, legend, grid lines, political boundaries, yellow border frame.
Style: 1920s aviator navigation chart on aged parchment, Aéropostale route map style."""

PROMPT_SOUTH = """Top-down vintage parchment map showing the sea between SOUTHERN SARDINIA and NORTHERN TUNISIA/NORTH AFRICA. PORTRAIT orientation.

LAYOUT (CRITICAL):
- TOP 25%: The southern tip of SARDINIA — just the bottom coast of the island (Cagliari area). Positioned center in the image.
- MIDDLE 50%: Open Mediterranean Sea — clearly teal/blue-green water. 
- BOTTOM 30%: The northern coast of TUNISIA/NORTH AFRICA — a wide band of land spanning most of the image width, with coastal features. The coast runs LEFT to RIGHT across the bottom.
- NO other islands visible.

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture with slight relief shading. NO green.
OCEAN/SEA COLOR: muted teal/blue-green, clearly distinct from land.
ABSOLUTELY NO: text, labels, borders, compass rose, decorations, legend, grid lines, political boundaries, yellow border frame.
Style: 1920s aviator navigation chart on aged parchment, Aéropostale route map style."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    for name, prompt, filename in [
        ("NORTH", PROMPT_NORTH, "sardegna-map-north.png"),
        ("CENTER", PROMPT_CENTER, "sardegna-map-center.png"),
        ("SOUTH", PROMPT_SOUTH, "sardegna-map-south.png"),
    ]:
        print(f"Generating Sardegna {name} map...")
        try:
            images = await image_gen.generate_images(
                prompt=prompt,
                model="gpt-image-1",
                number_of_images=1
            )
            if images and len(images) > 0:
                path = f"/app/frontend/assets/images/{filename}"
                with open(path, "wb") as f:
                    f.write(images[0])
                print(f"✓ Sardegna {name} map saved to {path}")
            else:
                print(f"✗ No {name} image generated")
        except Exception as e:
            print(f"✗ {name} Error: {e}")

asyncio.run(main())
