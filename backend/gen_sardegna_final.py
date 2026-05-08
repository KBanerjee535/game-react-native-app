"""Generate ONE coherent Sardegna map matching user's reference layout exactly."""
import asyncio
import os
import numpy as np
from dotenv import load_dotenv
load_dotenv()
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from PIL import Image, ImageFilter

PROMPT = """A vintage parchment navigation map viewed from directly above, showing a vertical strip of the Mediterranean Sea with THREE landmasses clearly visible and separated by water.

CRITICAL LAYOUT (THIS IS THE MOST IMPORTANT PART):
The image is PORTRAIT orientation (taller than wide).

FROM TOP TO BOTTOM:
1. TOP 5%: Open sea only
2. 5%-25%: CORSICA island. A medium-sized island positioned in the UPPER-CENTER to UPPER-RIGHT of the image. It has a roughly elongated north-south shape with rugged coastline. Takes about 30% of image width.
3. 25%-32%: STRAIT OF BONIFACIO - narrow channel of sea between the two islands, with tiny rocky islands (Maddalena)
4. 32%-70%: SARDINIA island. The LARGEST landmass, positioned CENTER of image. Much bigger than Corsica. It has:
   - Wide body (occupies 40-50% of image width)
   - Wider at top, narrows slightly toward bottom
   - Irregular coastline with bays on both sides
   - A large gulf/bay at the bottom
5. 70%-80%: OPEN MEDITERRANEAN SEA - clear water gap, no land
6. 80%-95%: NORTHERN TUNISIA coast. A wide band of continental coastline stretching across most of the image width, with Cap Bon peninsula pointing upward on the right side.
7. 95%-100%: More Tunisia inland

The THREE landmasses must be:
- Corsica: smaller, upper portion
- Sardinia: largest, center (dominant feature)
- Tunisia: wide coast, bottom portion

Each must be CLEARLY SEPARATED by sea. No overlapping, no merging.
The islands should be WIDE and fill the horizontal space naturally.

COLORS:
- LAND: warm sandy beige and tan (#D4B896 to #E8D5B5), subtle mountain texture, aged paper look. NO green vegetation.
- SEA: muted teal blue-green (#7A9A8A to #8DAD9C), slightly textured like old paper

ABSOLUTELY NO: text, labels, borders, compass, decorations, frame, legend, grid, icons.
Style: 1920s aviator navigation chart on aged yellowed parchment paper."""

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    print("🗺️ Generating ONE coherent Sardegna map...")
    images = await image_gen.generate_images(prompt=PROMPT, model="gpt-image-1", number_of_images=1)
    
    if not images:
        print("✗ No image generated")
        return
    
    with open("/tmp/sardegna_coherent.png", "wb") as f:
        f.write(images[0])
    
    full = Image.open("/tmp/sardegna_coherent.png")
    w, h = full.size
    print(f"Generated: {w}x{h}")
    
    # Resize to 1024 wide
    full_1024 = full.resize((1024, int(h * 1024 / w)), Image.LANCZOS)
    fh = full_1024.size[1]
    print(f"Resized: 1024x{fh}")
    
    # Split into 3 equal sectors
    sh = fh // 3
    north = full_1024.crop((0, 0, 1024, sh))
    center = full_1024.crop((0, sh, 1024, sh * 2))
    south = full_1024.crop((0, sh * 2, 1024, fh))
    
    # Resize each to 1024x1536
    north_r = north.resize((1024, 1536), Image.LANCZOS)
    center_r = center.resize((1024, 1536), Image.LANCZOS)
    south_r = south.resize((1024, 1536), Image.LANCZOS)
    
    north_r.save("/app/frontend/assets/images/sardegna-map-north.png")
    center_r.save("/app/frontend/assets/images/sardegna-map-center.png")
    south_r.save("/app/frontend/assets/images/sardegna-map-south.png")
    
    composite = Image.new('RGB', (1024, 4608))
    composite.paste(north_r, (0, 0))
    composite.paste(center_r, (0, 1536))
    composite.paste(south_r, (0, 3072))
    composite.save("/app/frontend/assets/images/sardegna-map.png")
    print(f"✓ Composite: {composite.size}")
    
    # Generate masks
    print("\n🗺️ Land masks:")
    for name, img in [("north", north_r), ("center", center_r), ("south", south_r)]:
        arr = np.array(img)
        mask_rows = []
        grid = 50
        ch, cw = img.height // grid, img.width // grid
        for row in range(grid):
            s = ""
            for col in range(grid):
                cell = arr[row*ch:(row+1)*ch, col*cw:(col+1)*cw]
                rm = float(cell[:,:,0].mean())
                bm = float(cell[:,:,2].mean())
                s += "1" if (rm - bm > 20 and rm > 150) else "0"
            mask_rows.append(s)
        
        land = sum(r.count('1') for r in mask_rows)
        print(f"\nsardegna_{name}: {land}/2500 ({100*land/2500:.1f}%)")
        for r in mask_rows:
            print(f'    "{r}",')
    
    print("\n✅ Done!")

asyncio.run(main())
