from PIL import Image

im = Image.open('C:/Users/upadh/.gemini/antigravity/brain/88baef9f-4cb3-4a0b-a1a9-59c49a68c438/wa_search_typed.png')

# The search bar has a distinct light grey fill, e.g. rgb(246, 245, 244) or rgb(240, 240, 240)
# Let's find all pixels in the upper-left area (x in 50..350, y in 80..200) that match that grey
grey_pixels = []
for y in range(80, 200):
    for x in range(50, 350):
        r, g, b = im.getpixel((x, y))[:3]
        if 242 <= r <= 248 and 242 <= g <= 248 and 242 <= b <= 248:
            grey_pixels.append((x, y))

if grey_pixels:
    min_x = min(p[0] for p in grey_pixels)
    max_x = max(p[0] for p in grey_pixels)
    min_y = min(p[1] for p in grey_pixels)
    max_y = max(p[1] for p in grey_pixels)
    print(f"Search box in 1920x1080: x from {min_x} to {max_x} (center: {(min_x+max_x)//2}), y from {min_y} to {max_y} (center: {(min_y+max_y)//2})")
else:
    print("No grey pixels found")

