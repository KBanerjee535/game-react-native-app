"""Generate a vintage parchment-style map of Central South America (Andes region)."""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

async def generate_andes_map():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    prompt = """Top-down vintage parchment map of central South America, PORTRAIT orientation (taller than wide).

CRITICAL LAYOUT - the image must show:
- LEFT 15% of image = PACIFIC OCEAN (light blue-teal water)
- CENTER 65% = SOUTH AMERICAN CONTINENT (warm beige/parchment land)
- RIGHT 20% = ATLANTIC OCEAN (light blue-teal water)
The oceans MUST be clearly visible and take significant space on both left and right sides.

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), with natural texture like aged paper. NO green tones.
OCEAN COLOR: distinct light blue-teal, very clearly different from the beige land.

TERRAIN RELIEF on land:
- ANDES MOUNTAINS: prominent mountain chain running north-south on the LEFT SIDE of the land mass (near Pacific coast). Show realistic relief with darker brown/tan shading for elevation.
- LOWLANDS (center-east): flat parchment beige
- Subtle river lines visible (dark thin lines)

ABSOLUTELY NO: text, labels, borders, compass, decorations. Just pure terrain map.
Style: 1920s aviator navigation chart, aged parchment paper."""

    print("Generating Andes map... (this may take up to 60 seconds)")
    images = await image_gen.generate_images(
        prompt=prompt,
        model="gpt-image-1",
        number_of_images=1
    )
    
    if images and len(images) > 0:
        output_path = "/app/frontend/assets/images/andes-map-v3.png"
        with open(output_path, "wb") as f:
            f.write(images[0])
        print(f"Map saved to {output_path}")
        
        # Also save backup
        with open("/app/backend/andes-map-v3-original.png", "wb") as f:
            f.write(images[0])
        print("Backup saved")
    else:
        print("ERROR: No image generated!")

asyncio.run(generate_andes_map())
