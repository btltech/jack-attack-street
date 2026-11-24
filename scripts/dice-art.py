#!/usr/bin/env python3
"""Regenerates Street Dice icons and the social preview image (needs Pillow and macOS fonts).
   python3 scripts/dice-art.py"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, os

OUT = 'public'
FONT = '/System/Library/Fonts/Supplemental/Arial Black.ttf'
PIPS = {1: [(1, 1)], 2: [(0, 0), (2, 2)], 3: [(0, 0), (1, 1), (2, 2)], 4: [(0, 0), (2, 0), (0, 2), (2, 2)],
        5: [(0, 0), (2, 0), (1, 1), (0, 2), (2, 2)], 6: [(0, 0), (2, 0), (0, 1), (2, 1), (0, 2), (2, 2)]}

def gradient(w, h, c1, c2):
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = (x / w * 0.5 + y / h * 0.5)
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    return img

def die(size, value, angle=0, pip=(15, 23, 42)):
    s = size * 3  # supersample for smooth edges
    d = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    g = ImageDraw.Draw(d)
    r = int(s * 0.2)
    g.rounded_rectangle((0, int(s * 0.04), s - 1, s - 1), r, fill=(148, 163, 184, 255))  # thick lower edge
    g.rounded_rectangle((0, 0, s - 1, int(s * 0.94)), r, fill=(248, 250, 252, 255))
    m = s * 0.2
    step = (s * 0.94 - 2 * m) / 2
    pr = s * 0.085
    for cx, cy in PIPS[value]:
        x, y = m + cx * (s - 2 * m) / 2, m + cy * step
        g.ellipse((x - pr, y - pr, x + pr, y + pr), fill=pip + (255,))
    d = d.rotate(angle, resample=Image.BICUBIC, expand=True)
    return d.resize((int(d.width / 3), int(d.height / 3)), Image.LANCZOS)

def paste_die(base, d, xy, blur=16, alpha=130, dy=14):
    pad = blur * 3
    sh = Image.new('RGBA', (d.width + pad * 2, d.height + pad * 2), (0, 0, 0, 0))
    mask = Image.new('L', sh.size, 0)
    mask.paste(d.getchannel('A').point(lambda a: alpha if a > 0 else 0), (pad, pad))
    sh.putalpha(mask.filter(ImageFilter.GaussianBlur(blur)))
    base.paste(sh, (xy[0] - pad, xy[1] - pad + dy), sh)
    base.paste(d, xy, d)

def icon(size):
    img = gradient(size, size, (136, 19, 55), (30, 6, 12)).convert('RGBA')
    d1 = die(int(size * 0.5), 5, -12)
    d2 = die(int(size * 0.42), 6, 14, pip=(15, 23, 42))
    paste_die(img, d1, (int(size * 0.08), int(size * 0.14)), blur=max(4, size // 40), dy=size // 40)
    paste_die(img, d2, (int(size * 0.5), int(size * 0.48)), blur=max(4, size // 40), dy=size // 40)
    return img.convert('RGB')

os.makedirs(f'{OUT}/dice', exist_ok=True)
for name, size in (('icon-192', 192), ('icon-512', 512), ('apple-touch-icon', 180), ('favicon-32', 32)):
    icon(max(size, 256)).resize((size, size), Image.LANCZOS).save(f'{OUT}/dice/{name}.png')

# Social preview 1200x630
W, H = 1200, 630
img = gradient(W, H, (136, 19, 55), (24, 4, 10)).convert('RGBA')
g = ImageDraw.Draw(img)
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse((620, 60, 1180, 620), fill=(251, 191, 36, 70))
img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(70)))
g = ImageDraw.Draw(img)
f_big = ImageFont.truetype(FONT, 124)
f_mid = ImageFont.truetype(FONT, 34)
f_small = ImageFont.truetype(FONT, 25)
g.text((70, 150), 'STREET', font=f_big, fill=(253, 224, 71, 255))
g.text((70, 270), 'DICE', font=f_big, fill=(255, 255, 255, 255))
g.text((74, 430), 'Push your luck. Bank before it busts.', font=f_mid, fill=(254, 205, 211, 255))
g.text((74, 490), 'Free daily game · 5 rounds · same rolls for all', font=f_small, fill=(253, 164, 175, 255))
g.text((74, 560), 'jackattackstreets.com/dice', font=f_small, fill=(251, 191, 36, 255))
paste_die(img, die(250, 6, -10), (800, 70))
paste_die(img, die(250, 6, 12), (900, 300))
paste_die(img, die(130, 1, 25, pip=(220, 38, 38)), (790, 380))
img.convert('RGB').save(f'{OUT}/og-dice.png', optimize=True)
print('done')
