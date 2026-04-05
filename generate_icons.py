import os
from PIL import Image, ImageDraw, ImageFont

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    
    # Modern vivid blue background with slightly less padding
    padding = size // 16
    radius = size // 5
    d.rounded_rectangle(
        [(padding, padding), (size - padding, size - padding)],
        radius=radius,
        fill=(37, 99, 235, 255) # #2563eb
    )
    
    # Render the 'T'
    try:
        font_size = int(size * 0.6)
        font = ImageFont.truetype("arialbd.ttf", font_size)
    except IOError:
        font = ImageFont.load_default()

    text = "T"
    bbox = d.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    
    # Position T slightly up and left to make room for cursor
    x = (size - w) / 2 - (size * 0.08)
    y = (size - h) / 2 - (size * 0.08)
    d.text((x, y), text, fill=(255, 255, 255, 255), font=font)
    
    # Mouse Pointer arrow coordinates 
    # Standard top-left pointing cursor shape
    scale = size * 0.022
    ox = size * 0.45
    oy = size * 0.45
    raw_pts = [ (0,0), (0,16), (4,12), (8,20), (12,18), (8,10), (14,10) ]
    poly_pts = [(ox + p[0]*scale, oy + p[1]*scale) for p in raw_pts]
    
    # Draw drop shadow/border for the cursor
    shadow_offset = max(1, size // 32)
    shadow_pts = [(p[0], p[1] + shadow_offset) for p in poly_pts]
    d.polygon(shadow_pts, fill=(15, 23, 42, 180)) # Dark shadow
    
    # Draw dark outline by shifting minimally
    d.polygon(poly_pts, fill=(255, 255, 255, 255), outline=(15, 23, 42, 255))
    
    img.save(f"assets/{filename}")

# Generate standard extension icon sizes
create_icon(16, 'icon16.png')
create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')

print("Nuevo icono de T + Cursor generado.")
