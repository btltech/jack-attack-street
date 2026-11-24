#!/usr/bin/env python3
"""Regenerates the Market Margin app icons (needs Pillow and macOS fonts).
   python3 scripts/market-art.py"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = 'public/market-margin'
FONT = '/System/Library/Fonts/Supplemental/Arial Black.ttf'
BG, LIME, INK = (20, 27, 22), (218, 238, 130), (28, 42, 32)

def icon(size):
    s = size * 3  # supersample
    img = Image.new('RGB', (s, s), BG)
    g = ImageDraw.Draw(img)
    pad = int(s * 0.17)
    g.rounded_rectangle((pad, pad, s - pad, s - pad), int(s * 0.16), fill=LIME)
    # a "price tag" notch: three receipt lines under the letter
    f = ImageFont.truetype(FONT, int(s * 0.46))
    g.text((s / 2, s * 0.44), 'M', font=f, fill=INK, anchor='mm')
    for i, w in enumerate((0.34, 0.26)):
        y = s * (0.70 + i * 0.065)
        g.rounded_rectangle((s / 2 - s * w / 2, y, s / 2 + s * w / 2, y + s * 0.03), int(s * 0.015), fill=INK)
    return img.resize((size, size), Image.LANCZOS)

os.makedirs(OUT, exist_ok=True)
for name, size in (('icon-192', 192), ('icon-512', 512), ('apple-touch-icon', 180), ('favicon-32', 32)):
    icon(size).save(f'{OUT}/{name}.png', optimize=True)
