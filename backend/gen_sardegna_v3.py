"""Generate 3 separate Sardegna sector maps, each 1024x1536, no distortion."""
import asyncio
import os
import numpy as np
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

PROMPTS = {
    "north": """Top-down vintage parchment navigation map showing SOUTHERN CORSICA and the STRAIT OF BONIFACIO and the very NORTHERN TIP of SARDINIA.

LAYOUT (portrait 2:3 ratio):
- TOP 40%: The SOUTHERN HALF of Corsica island. Show generous amount of the island with rugged mountainous coast, deep bays (Ajaccio, Bonifacio area). The island is positioned CENTER, slightly left. Corsica takes up significant space.
- MIDDLE 15%: STRAIT OF BONIFACIO — narrow turquoise channel with tiny rocky Maddalena islands as small dots.  
- BOTTOM 45%: NORTHERN SARDINIA coast beginning. Show the Gallura coast with deep indented bays (Costa Smeralda area), the island widening. The Sardinia coast stretches across most of the width.

Both islands should be WIDE and naturally proportioned, filling the horizontal space well.

COLORS: Land = warm sandy beige/tan (#D4B896 to #E8D5B5). Sea = muted teal (#7A9A8A to #8DAD9C).
NO text, NO labels, NO borders, NO compass, NO decorations, NO frame, NO legend.
Style: aged parchment paper, 1920s aviation chart.""",

    "center": """Top-down vintage parchment navigation map showing the CENTRAL BODY of SARDINIA island.

LAYOUT (portrait 2:3 ratio):
- The ENTIRE image shows the wide central portion of Sardinia island
- The island fills at least 60% of the image width
- Western coast: Gulf of Oristano (large bay indent), Alghero coast
- Eastern coast: relatively straight, Tyrrhenian coast
- Interior: subtle mountain spine texture running north-south
- The island EXTENDS from top edge to bottom edge (it continues beyond both edges)
- Small strips of sea visible on left and right sides

The island should look WIDE and substantial, not thin.

COLORS: Land = warm sandy beige/tan (#D4B896 to #E8D5B5). Sea = muted teal (#7A9A8A to #8DAD9C).
NO text, NO labels, NO borders, NO compass, NO decorations, NO frame.
Style: aged parchment paper, 1920s aviation chart.""",

    "south": """Top-down vintage parchment navigation map showing SOUTHERN SARDINIA, open Mediterranean sea, and NORTHERN TUNISIA coast.

LAYOUT (portrait 2:3 ratio):
- TOP 30%: Southern portion of Sardinia island. Show the Gulf of Cagliari (wide bay) and the southwestern Sulcis coast. The island narrows toward its southern tip. Island takes good horizontal space.
- MIDDLE 25%: OPEN MEDITERRANEAN SEA — clear blue-green water, NO land, NO islands. This is a substantial sea gap.
- BOTTOM 45%: NORTHERN TUNISIA coastline. Show generous amount: Cap Bon peninsula jutting upward on the right side, Gulf of Tunis, irregular coastline with bays. Tunisia coast stretches across most of the image width. Show SIGNIFICANT amount of Tunisia land.

COLORS: Land = warm sandy beige/tan (#D4B896 to #E8D5B5). Sea = muted teal (#7A9A8A to #8DAD9C).
NO text, NO labels, NO borders, NO compass, NO decorations, NO frame.
Style: aged parchment paper, 1920s aviation chart.""",
}

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    from PIL import Image
    
    sectors = {}
    for name, prompt in PROMPTS.items():
        print(f"🗺️ Generating {name} sector...")
        try:
            images = await image_gen.generate_images(
                prompt=prompt,
                model="gpt-image-1",
                number_of_images=1
            )
            if images and len(images) > 0:
                path = f"/app/frontend/assets/images/sardegna-map-{name}.png"
                with open(path, "wb") as f:
                    f.write(images[0])
                
                img = Image.open(path)
                w, h = img.size
                print(f"  Generated: {w}x{h}")
                
                # Resize to exactly 1024x1536
                img_resized = img.resize((1024, 1536), Image.LANCZOS)
                img_resized.save(path)
                sectors[name] = img_resized
                print(f"  ✓ Saved {name} (1024x1536)")
            else:
                print(f"  ✗ No image for {name}")
        except Exception as e:
            print(f"  ✗ Error {name}: {e}")
    
    if len(sectors) == 3:
        # Build composite
        composite = Image.new('RGB', (1024, 1536 * 3))
        composite.paste(sectors['north'], (0, 0))
        composite.paste(sectors['center'], (0, 1536))
        composite.paste(sectors['south'], (0, 1536 * 2))
        composite.save("/app/frontend/assets/images/sardegna-map.png")
        print(f"\n✓ Composite: {composite.size}")
        
        # Generate land masks for each sector
        print("\n🗺️ Generating land masks...")
        for name, img in sectors.items():
            arr = np.array(img)
            mask_rows = []
            grid = 50
            cell_h = img.height // grid
            cell_w = img.width // grid
            
            for row in range(grid):
                row_str = ""
                for col in range(grid):
                    y1 = row * cell_h
                    y2 = min((row + 1) * cell_h, img.height)
                    x1 = col * cell_w
                    x2 = min((col + 1) * cell_w, img.width)
                    cell = arr[y1:y2, x1:x2]
                    r_mean = float(cell[:,:,0].mean())
                    g_mean = float(cell[:,:,1].mean())
                    b_mean = float(cell[:,:,2].mean())
                    r_b_diff = r_mean - b_mean
                    is_land = r_b_diff > 20 and r_mean > 145
                    row_str += "1" if is_land else "0"
                mask_rows.append(row_str)
            
            land = sum(r.count('1') for r in mask_rows)
            print(f"\n  sardegna_{name}: {land}/2500 ({100*land/2500:.1f}%)")
            print(f"  sardegna_{name}: [")
            for r in mask_rows:
                print(f'    "{r}",')
            print(f"  ],")
    
    print("\n✅ Done!")

asyncio.run(main())
