"""Generate a vintage parchment-style map of Europe matching the ANDES style."""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

async def generate_europe_map():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    prompt = """Top-down vintage parchment map of Europe, PORTRAIT orientation (taller than wide).

CRITICAL LAYOUT - the image must show:
- The European continent centered, from Iceland/Norway in the north to North Africa coast in the south
- From the Atlantic Ocean (west, Portugal/Ireland) to western Russia/Turkey (east)
- OCEAN/SEA areas clearly visible: Atlantic Ocean on left, Mediterranean Sea in south, North Sea, Baltic Sea, Norwegian Sea
- The seas and oceans should take roughly 35-40% of the total image area

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), with natural aged paper texture. NO green tones whatsoever.
OCEAN COLOR: distinct muted teal/blue-green, clearly different from the beige land. Same style as a 1920s nautical chart.

TERRAIN RELIEF on land (CRITICAL - must show realistic elevation):
- ALPS: prominent mountain range in central-south Europe with darker brown/tan shading
- PYRENEES: mountain range between France and Spain
- SCANDINAVIAN MOUNTAINS: running along Norway/Sweden border
- CARPATHIANS: curved mountain range in eastern Europe
- CAUCASUS hints in the far east
- LOWLANDS (Northern European Plain, French plains): flat light parchment beige
- Subtle river lines visible as thin dark curves (Rhine, Danube, Volga, Seine, Thames)
- Coastlines well-defined with natural edge

ABSOLUTELY NO: text, labels, country borders, political boundaries, compass rose, decorations, legend.
Just pure terrain relief map on aged parchment paper. Style: 1920s aviator navigation chart."""

    print("Generating Europe map... (this may take up to 60 seconds)")
    images = await image_gen.generate_images(
        prompt=prompt,
        model="gpt-image-1",
        number_of_images=1
    )
    
    if images and len(images) > 0:
        output_path = "/app/frontend/assets/images/europe-map-vintage-new.png"
        with open(output_path, "wb") as f:
            f.write(images[0])
        print(f"Map saved to {output_path}")
        
        # Backup
        with open("/app/backend/europe-map-ai-v2.png", "wb") as f:
            f.write(images[0])
        print("Backup saved")
    else:
        print("ERROR: No image generated!")

asyncio.run(generate_europe_map())
