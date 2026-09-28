"""Generates the app icons: a dark green tile with a cream pawn on a two-square strip.
Run:  python make_icons.py
"""
from PIL import Image, ImageDraw

GREEN = (31, 42, 36)
CREAM = (240, 217, 181)
BROWN = (181, 136, 99)


def draw(size, pad):
    S = 1024
    img = Image.new("RGB", (S, S), GREEN)
    d = ImageDraw.Draw(img)
    k = 1 - pad * 2                      # shrink everything into the safe zone
    cx = S / 2
    def sc(v): return S / 2 + (v - S / 2) * k
    # pawn: head, neck collar, flared body, base
    d.ellipse([sc(cx - 120), sc(210), sc(cx + 120), sc(450)], fill=CREAM)
    d.rounded_rectangle([sc(cx - 150), sc(430), sc(cx + 150), sc(490)], radius=30 * k, fill=CREAM)
    d.polygon([(sc(cx - 95), sc(480)), (sc(cx + 95), sc(480)), (sc(cx + 200), sc(760)), (sc(cx - 200), sc(760))], fill=CREAM)
    d.rounded_rectangle([sc(cx - 250), sc(740), sc(cx + 250), sc(830)], radius=40 * k, fill=CREAM)
    # two board squares under it
    d.rectangle([sc(212), sc(860), sc(512), sc(920)], fill=CREAM)
    d.rectangle([sc(512), sc(860), sc(812), sc(920)], fill=BROWN)
    return img.resize((size, size), Image.LANCZOS)


for s in (180, 192, 512):
    draw(s, 0.0).save(f"icons/icon-{s}.png")
draw(512, 0.1).save("icons/icon-maskable-512.png")
print("icons written")
