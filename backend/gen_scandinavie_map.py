"""Generate the Scandinavie campaign map in vintage parchment style."""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

PROMPT = """Top-down vintage parchment map of SCANDINAVIA, PORTRAIT orientation (taller than wide).

GEOGRAPHIC AREA:
- The map shows Scandinavia: Norway, Sweden, Finland, Denmark, and parts of the Baltic states
- Norway's dramatic fjord coastline on the LEFT/WEST side
- Sweden in the CENTER
- Finland on the RIGHT/EAST side
- Denmark at the BOTTOM-LEFT
- The Baltic Sea in the lower-center area
- Parts of northern Russia visible on the far right
- The Arctic/Norwegian Sea visible on the top-left
- The North Sea visible on the bottom-left

TERRAIN DETAIL:
- Norwegian coast: highly indented fjord coastline, mountainous spine (Scandinavian Mountains)
- Sweden: rolling hills, lakes (show Lake Vänern, Vättern as darker spots)
- Finland: flat terrain with many lakes (lake district)
- Denmark: flat peninsula and islands
- Clear land/sea boundary

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture with slight relief shading. NO green.
OCEAN/SEA COLOR: muted teal/blue-green, clearly distinguishable from land.
ABSOLUTELY NO: text, labels, borders, compass rose, decorations, legend, grid lines, political boundaries. Pure terrain map only.
Style: 1920s aviator navigation chart on aged parchment, identical to a vintage Aéropostale route map."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    output_path = "/app/frontend/assets/images/scandinavie-map.png"
    
    print("Generating Scandinavie map...")
    try:
        images = await image_gen.generate_images(
            prompt=PROMPT,
            model="gpt-image-1",
            number_of_images=1
        )
        
        if images and len(images) > 0:
            with open(output_path, "wb") as f:
                f.write(images[0])
            print(f"✓ Scandinavie map saved to {output_path}")
            return True
        else:
            print("✗ No image generated")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

asyncio.run(main())
