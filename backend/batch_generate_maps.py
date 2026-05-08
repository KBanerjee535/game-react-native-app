"""Batch generate all mission maps in vintage parchment style."""
import asyncio
import os
import sys
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

MAPS = [
    {
        "filename": "gibraltar-map.png",
        "prompt": """Top-down vintage parchment map showing the Strait of Gibraltar region, PORTRAIT orientation (taller than wide).

LAYOUT:
- TOP 55% = Southern Spain and the Iberian Peninsula (warm beige parchment land)
- CENTER = Strait of Gibraltar (narrow channel of teal/blue-green water connecting Atlantic to Mediterranean)
- BOTTOM 40% = Northern Morocco and North Africa (warm beige parchment land)
- LEFT edge = Atlantic Ocean (teal water)
- RIGHT = Mediterranean Sea (teal water)

TERRAIN RELIEF:
- Spanish mountains (Sierra Nevada, Betic Cordillera) with brown/tan elevation shading
- Moroccan Rif mountains with relief shading
- Flat coastal plains in lighter beige
- The strait is clearly visible as a narrow water passage

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture. NO green.
OCEAN/SEA COLOR: distinct muted teal/blue-green.
ABSOLUTELY NO: text, labels, borders, compass, decorations. Pure terrain map.
Style: 1920s aviator navigation chart on aged parchment."""
    },
    {
        "filename": "mauritanie-map.png",
        "prompt": """Top-down vintage parchment map of Mauritania and Western Sahara region, PORTRAIT orientation.

LAYOUT:
- LEFT 15% = Atlantic Ocean (teal/blue-green water) along the west coast
- CENTER and RIGHT = vast Saharan desert terrain
- The coastline runs roughly north-south on the left side

TERRAIN RELIEF:
- Vast flat desert plains in warm sandy beige tones
- Subtle sand dune patterns and textures across the desert
- Rocky plateaus (like Adrar plateau) with slight elevation shading
- Coastal strip slightly different texture from deep desert
- A few dry riverbeds (oueds) as faint lines
- The terrain should look arid, sun-baked, and inhospitable

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE) with subtle sandy texture variations. NO green.
OCEAN COLOR: distinct muted teal/blue-green on the left coast.
ABSOLUTELY NO: text, labels, borders, compass, decorations. Pure desert terrain map.
Style: 1920s aviator navigation chart on aged parchment."""
    },
    {
        "filename": "atlantique-map.png",
        "prompt": """Top-down vintage parchment map showing the Atlantic Ocean crossing between Africa and South America, PORTRAIT orientation.

LAYOUT:
- TOP-LEFT corner = West African coast (Guinea, Senegal) - warm beige parchment land, roughly 20% of image
- CENTER = vast Atlantic Ocean (teal/blue-green water) - roughly 50-60% of the image
- BOTTOM-RIGHT = Eastern Brazilian coast (Natal/Recife area) - warm beige parchment land, roughly 20% of image
- The ocean dominates the center, with land masses in opposite corners

TERRAIN:
- African coast: slight coastal relief, flat tropical terrain
- Brazilian coast: slight coastal relief, flat terrain
- Ocean: subtle wave patterns or depth variations in teal tones
- Cape Verde islands visible as tiny land specks in the ocean

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE).
OCEAN COLOR: dominant muted teal/blue-green.
ABSOLUTELY NO: text, labels, borders, compass, decorations. Pure terrain map.
Style: 1920s aviator navigation chart on aged parchment."""
    },
    {
        "filename": "amazonie-map.png",
        "prompt": """Top-down vintage parchment map of the Amazon basin in Brazil, PORTRAIT orientation.

LAYOUT:
- Almost entirely LAND - the Amazon rainforest region
- RIGHT edge: a small strip of Atlantic Ocean (teal water) along the Brazilian coast
- The rest is dense inland territory

TERRAIN RELIEF:
- Dense forest texture across most of the map - shown as slightly darker/richer parchment tones
- Amazon River and its major tributaries clearly visible as dark winding lines through the terrain
- Rio Negro, Solimões, Tapajós rivers as prominent dark curves
- Northern edge: Guiana Highlands with subtle elevation
- Southern edge: Brazilian Plateau beginning, slightly elevated terrain
- The overall texture should convey dense, impenetrable jungle terrain
- Subtle variations in terrain tone to show the river flood plains vs upland areas

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE) with richer/darker patches for dense forest. NO green.
OCEAN/WATER COLOR: teal/blue-green for the coast and rivers.
ABSOLUTELY NO: text, labels, borders, compass, decorations. Pure terrain map.
Style: 1920s aviator navigation chart on aged parchment."""
    },
    {
        "filename": "buenosaires-map.png",
        "prompt": """Top-down vintage parchment map of the Buenos Aires / Rio de la Plata coastal region, PORTRAIT orientation.

LAYOUT:
- LEFT/CENTER = Argentine and Uruguayan coast (warm beige parchment land)
- RIGHT = Atlantic Ocean (teal/blue-green water), roughly 35-40% of image
- CENTER = Rio de la Plata estuary as a wide funnel of water opening to the ocean
- The coastline runs roughly from north to south with the Plata estuary prominent

TERRAIN RELIEF:
- Flat Pampas grasslands inland - light flat parchment beige
- Rio de la Plata as a wide brown/teal estuary
- Paraná and Uruguay rivers converging into the Plata
- Subtle coastal features and sandy beaches
- Very flat terrain overall (Pampas) with minimal elevation
- Some slightly elevated terrain in the north (Uruguay hills)

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE).
OCEAN/WATER COLOR: distinct muted teal/blue-green.
ABSOLUTELY NO: text, labels, borders, compass, decorations. Pure terrain map.
Style: 1920s aviator navigation chart on aged parchment."""
    },
    {
        "filename": "patagonie.png",
        "prompt": """Top-down vintage parchment map of Patagonia and Tierra del Fuego, PORTRAIT orientation.

LAYOUT:
- LEFT = Pacific Ocean (teal/blue-green water), roughly 20%
- CENTER = Patagonian land mass narrowing to the south
- RIGHT = Atlantic Ocean (teal/blue-green water), roughly 25%
- BOTTOM = Tierra del Fuego archipelago with the Strait of Magellan
- Both oceans clearly visible on either side

TERRAIN RELIEF:
- Andes mountains running along the western edge with strong relief shading
- Flat Patagonian steppe in the center-east - windswept plain in light beige
- Glacial lakes in the south as small teal spots
- Strait of Magellan as a clear water channel near the bottom
- Rugged coastline with fjords on the Pacific (western) side
- Tierra del Fuego islands at the very bottom

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE).
OCEAN COLOR: distinct muted teal/blue-green.
ABSOLUTELY NO: text, labels, borders, compass, decorations. Pure terrain map.
Style: 1920s aviator navigation chart on aged parchment."""
    },
    {
        "filename": "paraguay-map.png",
        "prompt": """Top-down vintage parchment map of Paraguay and surrounding regions, PORTRAIT orientation.

LAYOUT:
- Entirely LANDLOCKED - no ocean visible
- CENTER = Paraguay (flat plains and wetlands)
- The map shows central South America interior

TERRAIN RELIEF:
- Gran Chaco (western Paraguay): dry flat plains in light parchment beige
- Eastern Paraguay: slightly more textured terrain with subtle hills
- Paraguay River running north-south through the center as a dark winding line
- Paraná River on the eastern edge as another major dark river line
- Wetlands/marshes of the Pantanal in the north shown as slightly different texture
- Very flat overall with the rivers being the dominant geographic features
- Subtle terrain variations between the dry Chaco west and the more fertile east

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE) with subtle variations.
RIVER COLOR: darker brown/tan lines for rivers.
ABSOLUTELY NO: text, labels, borders, compass, decorations. Pure terrain map.
Style: 1920s aviator navigation chart on aged parchment."""
    },
    {
        "filename": "africa-again-map.png",
        "prompt": """Top-down vintage parchment map of West/Central Africa, PORTRAIT orientation.

LAYOUT:
- LEFT 20% = Atlantic Ocean (teal/blue-green water)
- CENTER/RIGHT = African continent from Sahara (north) to Gulf of Guinea (south)
- The coastline curves from northwest to southeast

TERRAIN RELIEF:
- NORTH: Saharan desert terrain - flat sandy beige with subtle dune textures
- CENTER: Sahel transition zone - slightly different parchment texture
- SOUTH: More textured terrain suggesting tropical/equatorial regions
- Niger River as a major dark curved line flowing through the terrain
- Subtle elevation changes from the desert plains to the southern plateaus
- The terrain gradually changes texture from arid north to tropical south
- Some highland areas (Jos Plateau, Cameroon highlands) with relief shading

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE) with arid sandy variations in the north.
OCEAN COLOR: distinct muted teal/blue-green on the west coast.
ABSOLUTELY NO: text, labels, borders, compass, decorations. Pure terrain map.
Style: 1920s aviator navigation chart on aged parchment."""
    },
    {
        "filename": "sahel-map.png",
        "prompt": """Top-down vintage parchment map of the Sahel region of Africa, PORTRAIT orientation.

LAYOUT:
- LEFT 15% = Atlantic Ocean (teal/blue-green water) along the west coast
- The rest = vast Sahelian terrain stretching east
- Semi-arid transitional zone between Sahara (north) and tropical Africa (south)

TERRAIN RELIEF:
- Northern part: drier, more Saharan with subtle sand dune textures
- Central Sahel band: semi-arid scrubland texture in varied parchment tones
- Southern part: slightly richer terrain texture suggesting more vegetation
- Senegal River, Niger River as dark winding lines
- Lake Chad as a small teal body of water on the eastern side
- Flat terrain overall with subtle undulations
- Fouta Djallon highlands (Guinea) with slight elevation in the southwest
- The texture should convey a harsh, dry landscape

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE) with sandy/arid variations.
OCEAN/WATER COLOR: muted teal/blue-green.
ABSOLUTELY NO: text, labels, borders, compass, decorations. Pure terrain map.
Style: 1920s aviator navigation chart on aged parchment."""
    },
    {
        "filename": "campagne-europe-map.png",
        "prompt": """Top-down vintage parchment map of ALL of Europe, PORTRAIT orientation (taller than wide).

LAYOUT - must show the ENTIRE European continent:
- From Iceland and northern Norway/Russia at the TOP
- To North Africa (Tunisia, Libya coast) at the BOTTOM
- From the Atlantic Ocean/Ireland at the LEFT
- To western Russia/Turkey at the RIGHT
- Oceans and seas clearly visible: Atlantic, Mediterranean, North Sea, Baltic, Norwegian Sea, Black Sea

TERRAIN RELIEF (CRITICAL - must show realistic elevation):
- ALPS: prominent mountain range in central-south Europe with darker brown/tan shading
- PYRENEES: mountains between France and Spain
- SCANDINAVIAN MOUNTAINS: along Norway/Sweden
- CARPATHIANS: curved mountain range in eastern Europe
- CAUCASUS mountains in the far east
- ATLAS MOUNTAINS in North Africa
- URAL mountains suggestion on the far east edge
- Northern European Plain: flat light beige
- Iberian Meseta: elevated plateau
- Rivers visible: Rhine, Danube, Volga, Seine, Thames as dark thin curves

LAND COLOR: warm parchment beige (#E1CB9F to #F0E1BE), aged paper texture. NO green.
OCEAN/SEA COLOR: distinct muted teal/blue-green, clearly different from land.
ABSOLUTELY NO: text, labels, country borders, compass, decorations.
Style: 1920s aviator navigation chart on aged parchment."""
    },
]

async def generate_map(image_gen, map_info, index, total):
    name = map_info["filename"]
    output_path = f"/app/frontend/assets/images/{name}"
    backup_path = f"/app/backend/generated-{name}"
    
    print(f"\n[{index+1}/{total}] Generating {name}...")
    try:
        images = await image_gen.generate_images(
            prompt=map_info["prompt"],
            model="gpt-image-1",
            number_of_images=1
        )
        
        if images and len(images) > 0:
            with open(output_path, "wb") as f:
                f.write(images[0])
            with open(backup_path, "wb") as f:
                f.write(images[0])
            print(f"  ✓ Saved {name}")
            return True
        else:
            print(f"  ✗ No image generated for {name}")
            return False
    except Exception as e:
        print(f"  ✗ Error generating {name}: {e}")
        return False

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    # Allow selecting specific map by index
    if len(sys.argv) > 1:
        indices = [int(x) for x in sys.argv[1:]]
        maps_to_generate = [(i, MAPS[i]) for i in indices if i < len(MAPS)]
    else:
        maps_to_generate = list(enumerate(MAPS))
    
    total = len(maps_to_generate)
    print(f"Generating {total} maps...")
    
    success = 0
    for idx, (original_idx, map_info) in enumerate(maps_to_generate):
        result = await generate_map(image_gen, map_info, idx, total)
        if result:
            success += 1
    
    print(f"\n{'='*50}")
    print(f"Done! {success}/{total} maps generated successfully.")

asyncio.run(main())
