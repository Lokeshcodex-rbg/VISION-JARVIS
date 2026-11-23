from PIL import Image

im = Image.open('C:/Users/upadh/.gemini/antigravity/brain/88baef9f-4cb3-4a0b-a1a9-59c49a68c438/wa_live_screen_cancelled.png')
# Let's inspect the search box region: x from 60 to 280, y from 120 to 160
# Find background or text of the search box
for y in range(125, 160, 5):
    p = im.getpixel((150, y))
    print(f"y={y}: {p}")

for x in range(50, 300, 20):
    p = im.getpixel((x, 140))
    print(f"x={x}: {p}")

