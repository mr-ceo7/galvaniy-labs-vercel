from PIL import Image, ImageDraw
import sys

def remove_bg_floodfill(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    
    # Need to do flood fill from all 4 corners to be safe
    rgb_img = img.convert("RGB")
    width, height = rgb_img.size
    
    corners = [(0,0), (width-1, 0), (0, height-1), (width-1, height-1)]
    for corner in corners:
        ImageDraw.floodfill(rgb_img, corner, (255, 0, 255), thresh=30)
    
    datas_rgb = rgb_img.getdata()
    datas_rgba = img.getdata()
    
    newData = []
    for rgb_pixel, rgba_pixel in zip(datas_rgb, datas_rgba):
        if rgb_pixel == (255, 0, 255):
            newData.append((255, 255, 255, 0))
        else:
            # simple feathering: if the pixel is very bright, make it semi-transparent
            # to blend the jagged edge
            luma = 0.299 * rgba_pixel[0] + 0.587 * rgba_pixel[1] + 0.114 * rgba_pixel[2]
            if luma > 245:
                # likely an anti-aliased edge pixel
                newData.append((rgba_pixel[0], rgba_pixel[1], rgba_pixel[2], int(255 - (luma - 245)*25)))
            else:
                newData.append(rgba_pixel)
            
    img.putdata(newData)
    img.save(output_path, "PNG")

remove_bg_floodfill(sys.argv[1], sys.argv[2])
