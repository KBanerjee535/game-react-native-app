"""Generate land masks for all new maps and output TypeScript constants."""
from PIL import Image
import numpy as np

MAPS_TO_ANALYZE = [
    ("campagne-europe-map.png", "CAMPAGNE_EUROPE_LAND_MASK"),
]

# Maps where land detection needs specific thresholds
THRESHOLD_OVERRIDES = {}

for filename, const_name in MAPS_TO_ANALYZE:
    path = f"/app/frontend/assets/images/{filename}"
    img = Image.open(path)
    if img.mode == 'RGBA':
        img = img.convert('RGB')
    arr = np.array(img)
    h, w = arr.shape[:2]
    r, g, b = arr[:,:,0].astype(float), arr[:,:,1].astype(float), arr[:,:,2].astype(float)
    diff = r - b
    
    # Try different thresholds to find the best one
    print(f"\n{'='*60}")
    print(f"{filename} ({w}x{h})")
    print(f"R-B: min={diff.min():.0f} max={diff.max():.0f} mean={diff.mean():.0f}")
    
    best_thresh = THRESHOLD_OVERRIDES.get(filename, None)
    if best_thresh is None:
        # Auto-detect: find threshold that gives reasonable land/sea ratio
        for thresh in [20, 25, 30, 35, 40, 50]:
            land_pct = (diff > thresh).mean() * 100
            print(f"  R-B > {thresh}: {land_pct:.0f}% land")
        # Pick threshold based on expected sea coverage
        for thresh in [25, 30, 35, 40, 50]:
            land_pct = (diff > thresh).mean() * 100
            if land_pct < 90:
                best_thresh = thresh
                break
        if best_thresh is None:
            best_thresh = 30
    
    land_mask = diff > best_thresh
    GRID = 50
    
    print(f"\nUsing threshold: {best_thresh}")
    
    # Generate grid
    grid = np.zeros((GRID, GRID), dtype=int)
    for gy in range(GRID):
        for gx in range(GRID):
            y1 = int(gy * h / GRID)
            y2 = int((gy + 1) * h / GRID)
            x1 = int(gx * w / GRID)
            x2 = int((gx + 1) * w / GRID)
            pct = land_mask[y1:y2, x1:x2].mean()
            grid[gy, gx] = 1 if pct > 0.55 else 0
    
    land_count = grid.sum()
    total = GRID * GRID
    sea_count = total - land_count
    print(f"Land: {land_count}, Sea: {sea_count} ({sea_count/total*100:.0f}% sea)")
    
    # Visual
    for gy in range(GRID):
        row = ''
        for gx in range(GRID):
            row += '█' if grid[gy, gx] else '·'
        print(row)
    
    # TypeScript output
    print(f"\nconst {const_name}: string[] = [")
    for gy in range(GRID):
        row = ''
        for gx in range(GRID):
            row += '1' if grid[gy, gx] else '0'
        print(f'  "{row}",')
    print("];")
