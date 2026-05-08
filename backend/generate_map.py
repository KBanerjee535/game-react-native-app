import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

async def generate_europe_map():
    api_key = os.getenv("EMERGENT_LLM_KEY", "sk-emergent-1476812448a63B9C7F")
    
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    prompt = """Create a detailed vintage-style map of Europe, viewed from above, showing the entire continent from Iceland in the northwest to Turkey and the Black Sea in the southeast, from the Norwegian Sea in the north to North Africa (Morocco, Algeria, Tunisia, Libya) in the south.

STYLE: Antique/vintage parchment map style, like an old 1920s aviation chart.
- Land masses in warm ochre/yellow-beige color with subtle parchment texture
- Oceans and seas in muted steel blue/grey-blue color  
- Coastlines drawn with fine dark brown ink lines, very accurate and detailed
- No text labels, no city names, no country borders, no legends
- No compass rose, no decorative elements
- Clean, simple, just land vs sea with accurate coastline contours
- Slight aged parchment feel overall

GEOGRAPHY must be accurate:
- Iberian Peninsula (Spain, Portugal) clearly visible
- British Isles (Great Britain, Ireland) with correct shapes
- Scandinavian Peninsula (Norway, Sweden) with detailed fjord coastline
- Italian Peninsula (boot shape) with Sicily and Sardinia
- Greek Peninsula with Peloponnese and islands
- Baltic Sea clearly visible between Scandinavia and mainland
- Mediterranean Sea with all its gulfs
- Iceland in the top-left area
- North Africa coastline at the bottom

The map should fill the entire image edge to edge with no borders or frames."""

    print("Generating Europe map image... (this may take up to 60 seconds)")
    images = await image_gen.generate_images(
        prompt=prompt,
        model="gpt-image-1",
        number_of_images=1
    )
    
    if images and len(images) > 0:
        output_path = "/app/frontend/assets/images/europe-map-vintage-new.png"
        # Backup original first
        backup_path = "/app/frontend/assets/images/europe-map-vintage-new-backup.png"
        if os.path.exists(output_path) and not os.path.exists(backup_path):
            import shutil
            shutil.copy2(output_path, backup_path)
            print(f"Original backed up to {backup_path}")
        
        with open(output_path, "wb") as f:
            f.write(images[0])
        print(f"Map saved to {output_path} ({len(images[0])} bytes)")
    else:
        print("ERROR: No image was generated")

asyncio.run(generate_europe_map())
