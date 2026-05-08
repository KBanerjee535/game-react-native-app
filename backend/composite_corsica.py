"""Combine the North and South Corsica maps into a single composite image."""
from PIL import Image

north = Image.open("/app/frontend/assets/images/corsica-map-north.png")
south = Image.open("/app/frontend/assets/images/corsica-map-south.png")

# Resize both to the same width
target_width = max(north.width, south.width)
target_half_height = max(north.height, south.height)

north_resized = north.resize((target_width, target_half_height), Image.LANCZOS)
south_resized = south.resize((target_width, target_half_height), Image.LANCZOS)

# Stack vertically: North on top, South on bottom
composite = Image.new('RGB', (target_width, target_half_height * 2))
composite.paste(north_resized, (0, 0))
composite.paste(south_resized, (0, target_half_height))

composite.save("/app/frontend/assets/images/corsica-map.png", "PNG")
print(f"✓ Composite map saved: {target_width}x{target_half_height * 2}")
print(f"  North half: 0 to {target_half_height}")
print(f"  South half: {target_half_height} to {target_half_height * 2}")
