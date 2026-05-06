from PIL import Image
import sys
import math

def green_screen_key(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()
    newData = []
    
    for item in datas:
        r, g, b, a = item
        
        # Calculate how "green" the pixel is.
        # We want to be strict so we don't accidentally remove anything else.
        greenness = g - max(r, b)
        
        if greenness > 100:
            newData.append((r, g, b, 0))
        elif greenness > 40:
            alpha = int(255 * (1 - (greenness - 40) / 60))
            newData.append((r, g, b, alpha))
        else:
            newData.append(item)
            
    img.putdata(newData)
    img.save(output_path, "PNG")

green_screen_key(sys.argv[1], sys.argv[2])
