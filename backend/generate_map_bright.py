import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

async def generate_europe_map():
    api_key = os.getenv("EMERGENT_LLM_KEY", "sk-emergent-1476812448a63B9C7F")
    
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    prompt = """A BRIGHT, LIGHT, well-lit vintage-style map of Europe seen from above.

BRIGHTNESS: The map must be very bright and light, like a sun-bleached old parchment. Light ochre/cream tones. No dark areas.

COVERAGE: Full Europe from Iceland (top-left) to Turkey/Black Sea (right), Norwegian Sea (top) to North Africa coast (bottom: Morocco, Algeria, Tunisia, Libya).

COLORS:
- Land: LIGHT warm ochre/cream/pale yellow color - very bright and luminous
- Sea/Ocean: LIGHT sky blue / pale cerulean blue - not dark navy, bright and light  
- Coastlines: thin medium-brown ink lines, precise and accurate
- Overall very bright, high-key image, like a faded antique parchment in sunlight

MUST NOT INCLUDE: No text, no labels, no city names, no country names, no borders between countries, no compass, no decorations, no frame, no legend.

GEOGRAPHY (must be very accurate):
- Iceland top-left
- British Isles (Great Britain island + Ireland island) clearly separated by sea
- Iberian Peninsula clearly visible with correct coastline
- Scandinavian Peninsula with Norway/Sweden
- Italian Peninsula boot shape with Sicily, Sardinia, Corsica islands
- Greek peninsula and islands
- Baltic Sea between Scandinavia and mainland
- Mediterranean Sea
- Black Sea to the east
- North Africa coastline at the bottom edge

Fill the ENTIRE image edge to edge, no margins, no border."""

    print("Generating bright Europe map image...")
    images = await image_gen.generate_images(
        prompt=prompt,
        model="gpt-image-1",
        number_of_images=1
    )
    
    if images and len(images) > 0:
        output_path = "/app/frontend/assets/images/europe-map-vintage-new.png"
        with open(output_path, "wb") as f:
            f.write(images[0])
        print(f"Map saved to {output_path} ({len(images[0])} bytes)")
        
        # Check brightness
        from PIL import Image
        import numpy as np
        img = Image.open(output_path)
        arr = np.array(img)
        print(f"Size: {img.size}, Mean brightness: {arr.mean():.1f}/255")
    else:
        print("ERROR: No image was generated")

asyncio.run(generate_europe_map())
