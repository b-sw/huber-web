"""Render a tileable kraft-paper grain: dark fibres on a transparent tile.

The box hero draws this tile once as an SVG pattern. It replaces a live SVG
turbulence filter, which browsers recompute on every repaint.

Usage: python3 scripts/kraft-grain.py
"""

import random
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src/assets/textures/kraft-grain.png'
SIZE = 320
INK = (82, 56, 31)


def tileable_noise(seed: int, blur: tuple[float, float]) -> Image.Image:
    rng = random.Random(seed)
    tile = Image.new('L', (SIZE, SIZE))
    tile.putdata([rng.randint(0, 255) for _ in range(SIZE * SIZE)])
    # Blur a 3×3 copy and keep the middle, so the edges wrap without a seam.
    big = Image.new('L', (SIZE * 3, SIZE * 3))
    for i in range(3):
        for j in range(3):
            big.paste(tile, (i * SIZE, j * SIZE))
    stretched = big.resize((int(SIZE * 3 * blur[0]), int(SIZE * 3 * blur[1])), Image.BILINEAR)
    stretched = stretched.filter(ImageFilter.GaussianBlur(1.2))
    back = stretched.resize((SIZE * 3, SIZE * 3), Image.BICUBIC)
    return back.crop((SIZE, SIZE, SIZE * 2, SIZE * 2))


def main() -> None:
    fibres = tileable_noise(11, (0.3, 1.0)).point(lambda v: max(0, (v - 128) * 2))
    specks = tileable_noise(23, (1.0, 1.0)).point(lambda v: max(0, (v - 160) * 3))
    mottle = tileable_noise(37, (0.08, 0.08)).point(lambda v: max(0, v - 120) // 3)
    alpha = ImageChops.add(ImageChops.lighter(fibres, specks), mottle).point(lambda v: min(105, v))
    out = Image.new('RGBA', (SIZE, SIZE), INK + (0,))
    out.putalpha(alpha)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, optimize=True)
    print('wrote', OUT.relative_to(ROOT), OUT.stat().st_size // 1024, 'KiB')


if __name__ == '__main__':
    main()
