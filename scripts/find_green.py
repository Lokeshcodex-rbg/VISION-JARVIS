from PIL import Image

im = Image.open('C:/Users/upadh/.gemini/antigravity/brain/88baef9f-4cb3-4a0b-a1a9-59c49a68c438/.user_uploaded/media_1794303289515_bb96bd03.jpg')
W, H = im.size

# Look in region x from 400 to 520, y from 350 to 450
button_pixels = []
for y in range(350, 450):
    for x in range(400, 520):
        r, g, b = im.getpixel((x, y))[:3]
        if g > 150 and r < 80 and b < 130:
            button_pixels.append((x, y))

if button_pixels:
    min_x = min(p[0] for p in button_pixels)
    max_x = max(p[0] for p in button_pixels)
    min_y = min(p[1] for p in button_pixels)
    max_y = max(p[1] for p in button_pixels)
    cx = (min_x + max_x) // 2
    cy = (min_y + max_y) // 2
    print(f"Send Button in image: center=({cx}, {cy}), bounds=({min_x}, {min_y}, {max_x}, {max_y})")
    print(f"Normalized coords relative to image: x={cx/W:.3f}, y={cy/H:.3f}")

# Also find WhatsApp window boundary in image
# WhatsApp is from left 0 to around x=512 (half of 1024)
# WhatsApp window bottom is around y=420 (excluding taskbar which is 490..533)
print(f"Image W={W}, H={H}")
