"""Render a one-colour halftone print of each product photo.

The output keeps the source size and position, so a halftone and its photo
line up exactly when they share the same frame on the page.

Usage: python3 scripts/halftone.py
"""

import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'src/assets/products'
# Screen ruling in source pixels, and the products that get a print.
SCREENS = {
    'halftone': (11, ['rw-ezmptr']),
}

INK = (35, 26, 18)
ANGLE = math.radians(45)
SUPERSAMPLE = 3


def halftone(path: Path, cell: int) -> Image.Image:
    photo = Image.open(path).convert('RGBA')
    width, height = photo.size
    alpha = photo.getchannel('A')
    tone = ImageOps.autocontrast(photo.convert('L'), cutoff=2, mask=alpha)
    darkness = ImageChops.invert(tone)
    density = ImageChops.multiply(darkness, alpha).filter(ImageFilter.BoxBlur(cell // 3))

    dots = Image.new('L', (width * SUPERSAMPLE, height * SUPERSAMPLE), 0)
    draw = ImageDraw.Draw(dots)
    cos, sin = math.cos(ANGLE), math.sin(ANGLE)
    reach = int(math.hypot(width, height) / cell) + 2
    for i in range(-reach, reach):
        for j in range(-reach, reach):
            x = (i * cos - j * sin) * cell
            y = (i * sin + j * cos) * cell
            if not (0 <= x < width and 0 <= y < height):
                continue
            value = density.getpixel((int(x), int(y))) / 255
            if value < 0.04:
                continue
            radius = cell * 0.56 * math.sqrt(value ** 1.2) * SUPERSAMPLE
            cx, cy = x * SUPERSAMPLE, y * SUPERSAMPLE
            draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=255)
    dots = dots.resize((width, height), Image.LANCZOS)

    # A thin keyline keeps the silhouette crisp, like a print with an outline plate.
    solid = alpha.point(lambda a: 255 if a > 128 else 0)
    keyline = ImageChops.subtract(solid.filter(ImageFilter.MaxFilter(5)), solid)
    mask = ImageChops.lighter(dots, keyline)

    out = Image.new('RGBA', (width, height), INK + (0,))
    out.putalpha(mask)
    return out


def main() -> None:
    for folder, (cell, only) in SCREENS.items():
        target = ROOT / 'src/assets' / folder
        target.mkdir(parents=True, exist_ok=True)
        for path in sorted(SOURCE.glob('*.png')):
            if only and path.stem not in only:
                continue
            halftone(path, cell).save(target / path.name, optimize=True)
            print('wrote', (target / path.name).relative_to(ROOT))


if __name__ == '__main__':
    main()
