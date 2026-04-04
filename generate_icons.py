import os
from PIL import Image, ImageDraw, ImageFont

def create_icon(size, filename):
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    
    # Draw a blue rounded rectangle (minimalist)
    padding = size // 10
    radius = size // 5
    d.rounded_rectangle(
        [(padding, padding), (size - padding, size - padding)],
        radius=radius,
        fill=(59, 130, 246, 255) # Modern Blue
    )
    
    # Try to load a font, otherwise use default
    try:
        font_size = int(size * 0.6)
        font = ImageFont.truetype("arialbd.ttf", font_size)
    except IOError:
        font = ImageFont.load_default()

    # Draw the letter 'T'
    text = "T"
    
    # Calculate text position to center it
    # getbbox returns (left, top, right, bottom)
    bbox = d.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    
    # A bit of manual offset tweak because 'T' can look uncentered
    x = (size - w) / 2
    y = (size - h) / 2 - (size * 0.05) 
    
    d.text((x, y), text, fill=(255, 255, 255, 255), font=font)
    
    img.save(f"assets/{filename}")

# Generate standard extension icon sizes
create_icon(16, 'icon16.png')
create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')

print("Icons generated successfully.")
