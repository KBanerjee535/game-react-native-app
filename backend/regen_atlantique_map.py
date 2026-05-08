"""Regenerate the Atlantique map with correct geographic orientation and balanced land."""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

PROMPT = """Top-down vintage parchment map showing the South Atlantic Ocean crossing between West Africa and Brazil, PORTRAIT orientation (taller than wide).

GEOGRAPHIC LAYOUT (CRITICAL - equal land on both sides):
- TOP-RIGHT quadrant = West African coast (Guinea, Senegal, Sierra Leone) - warm beige parchment land occupying about 25% of the total image area
- CENTER = South Atlantic Ocean (teal/blue-green water) - about 50% of the image
- BOTTOM-LEFT quadrant = Eastern Brazilian coast (Natal, Recife, Pernambuco, Bahia) - warm beige parchment land occupying about 25% of the total image area
- IMPORTANT: Both land masses must be roughly EQUAL in visible area - same amount of Africa visible as Brazil
- Africa is on the RIGHT (east), Brazil is on the LEFT (west) - this is geographically correct
- The coastlines should be clearly defined and substantial, not just thin slivers

TERRAIN DETAIL:
- African coast (top-right): gentle coastal terrain with slight river deltas, inland plateaus
- Brazilian coast (bottom-left): coastal plain, slight relief, recognizable northeast Brazil bulge
- Ocean: subtle depth/wave variations in teal tones
- Cape Verde islands as tiny specks in the upper-center ocean
- Fernando de Noronha as tiny speck closer to Brazil

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture. NO green anywhere.
OCEAN COLOR: dominant muted teal/blue-green, clearly distinguishable from land.
ABSOLUTELY NO: text, labels, borders, compass, decorations, legend, grid lines. Pure terrain map only.
Style: 1920s aviator navigation chart on aged parchment."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    output_path = "/app/frontend/assets/images/atlantique-map.png"
    backup_path = "/app/backend/generated-atlantique-map.png"
    
    print("Generating new Atlantique map (balanced land: Guinea top-right, Brazil bottom-left)...")
    try:
        images = await image_gen.generate_images(
            prompt=PROMPT,
            model="gpt-image-1",
            number_of_images=1
        )
        
        if images and len(images) > 0:
            with open(output_path, "wb") as f:
                f.write(images[0])
            with open(backup_path, "wb") as f:
                f.write(images[0])
            print(f"✓ New Atlantique map saved to {output_path}")
            return True
        else:
            print("✗ No image generated")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

asyncio.run(main())
