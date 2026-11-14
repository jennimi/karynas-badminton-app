"""Cuts the 12 icons out of design/Rally Shuttlecock Icon Collection.png into
public/brand/rally-01.png ... rally-12.png (square, rounded transparent corners).

    python3 scripts/extract-brand-icons.py

The collection is a flat picture: a 4 x 3 grid of rounded tiles on a near-white
background with soft shadows. Left/right/top edges are found from the strongest
brightness change near where each tile sits (the shadow only falls below a tile,
so the bottom edge isn't trusted: tiles are square). Corners are then re-cut with
a clean anti-aliased rounded rectangle so no background or shadow is left.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "design/Rally Shuttlecock Icon Collection.png")
OUT = Path("public/brand")
SIZE = 256          # output size in px (the source tiles are ~272 px)
RADIUS = 0.255      # corner radius as a share of the tile width (measured on the dark tiles)
COLS = [(38, 308), (343, 614), (646, 918), (950, 1218)]   # rough x ranges (from the picture)
ROWS = [(125, 392), (470, 741), (822, 1098)]               # rough y ranges


def strongest(profile, lo, hi):
    return lo + int(np.abs(np.diff(profile))[lo:hi].argmax())


def main():
    img = Image.open(SRC).convert("RGB")
    gray = np.asarray(img.convert("L")).astype(float)
    OUT.mkdir(parents=True, exist_ok=True)
    n = 0
    for (y0, y1) in ROWS:
        for (x0, x1) in COLS:
            n += 1
            xc, yc = (x0 + x1) // 2, (y0 + y1) // 2
            across = gray[yc - 30:yc + 30, :].mean(axis=0)
            down = gray[:, xc - 30:xc + 30].mean(axis=1)
            left = strongest(across, x0 - 18, x0 + 18)
            right = strongest(across, x1 - 18, x1 + 18) + 1
            top = strongest(down, y0 - 18, y0 + 18)
            side = right - left
            # 1 px inside the detected edge so no shadow fringe survives
            tile = img.crop((left + 1, top + 1, left + side - 1, top + side - 1))
            s = tile.size[0]
            # anti-aliased rounded-rectangle mask, drawn 4x larger then shrunk
            k = 4
            mask = Image.new("L", (s * k, s * k), 0)
            ImageDraw.Draw(mask).rounded_rectangle((0, 0, s * k - 1, s * k - 1), radius=RADIUS * s * k, fill=255)
            mask = mask.resize((s, s), Image.LANCZOS)
            out = tile.convert("RGBA")
            out.putalpha(mask)
            out = out.resize((SIZE, SIZE), Image.LANCZOS)
            out.save(OUT / f"rally-{n:02d}.png", optimize=True)
            print(f"rally-{n:02d}.png  from ({left},{top}) side {side}")


if __name__ == "__main__":
    main()
