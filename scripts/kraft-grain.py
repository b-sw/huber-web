"""Render the kraft-board textures of the box hero as grey height maps.

Mid grey (128) leaves the board colour as it is. Darker pixels darken it and
lighter pixels lighten it, through a soft-light blend.

- kraft-grain.webp: a tileable tile of paper tooth, short fibres and specks.
- kraft-mottle.webp: one low-resolution map of uneven tone, stretched over the
  whole drawing, so it never repeats.

The box hero draws both once as static layers. They replace a live SVG
turbulence filter, which browsers recompute on every repaint.

Usage: python3 scripts/kraft-grain.py
"""

import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src/assets/textures'
TILE = 384
SUPERSAMPLE = 3
MOTTLE = (240, 152)


def wrap_blur(img: Image.Image, radius: float) -> Image.Image:
    w, h = img.size
    big = Image.new(img.mode, (w * 3, h * 3))
    for i in range(3):
        for j in range(3):
            big.paste(img, (i * w, j * h))
    return big.filter(ImageFilter.GaussianBlur(radius)).crop((w, h, w * 2, h * 2))


def tooth(rng: random.Random) -> Image.Image:
    raw = Image.new('L', (TILE, TILE))
    raw.putdata([min(255, max(0, round(rng.gauss(128, 40)))) for _ in range(TILE * TILE)])
    return wrap_blur(raw, 0.7)


def fibres(rng: random.Random, count: int, length: tuple[float, float], width: tuple[float, float], depth: tuple[int, int]) -> Image.Image:
    size = TILE * SUPERSAMPLE
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    for _ in range(count):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        # Most fibres lie along the machine direction of the liner, a few cross it.
        angle = rng.gauss(0, 0.32) if rng.random() < 0.8 else rng.uniform(0, math.pi)
        reach = rng.uniform(*length) * SUPERSAMPLE
        bend = rng.uniform(-0.5, 0.5)
        points = []
        for k in range(4):
            t = k / 3 - 0.5
            a = angle + bend * t
            points.append((x + math.cos(a) * reach * t, y + math.sin(a) * reach * t))
        stroke = max(1, round(rng.uniform(*width) * SUPERSAMPLE))
        value = rng.randint(*depth)
        for dx in (-size, 0, size):
            for dy in (-size, 0, size):
                draw.line([(px + dx, py + dy) for px, py in points], fill=value, width=stroke, joint='curve')
    return mask.resize((TILE, TILE), Image.LANCZOS)


def specks(rng: random.Random, count: int, radius: tuple[float, float], depth: tuple[int, int]) -> Image.Image:
    size = TILE * SUPERSAMPLE
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    for _ in range(count):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        rx = rng.uniform(*radius) * SUPERSAMPLE
        ry = rx * rng.uniform(0.45, 1)
        value = rng.randint(*depth)
        for dx in (-size, 0, size):
            for dy in (-size, 0, size):
                draw.ellipse((x + dx - rx, y + dy - ry, x + dx + rx, y + dy + ry), fill=value)
    return mask.resize((TILE, TILE), Image.LANCZOS)


def grain() -> Image.Image:
    rng = random.Random(11)
    base = tooth(rng)
    dark = ImageChops.lighter(fibres(rng, 1000, (5, 22), (0.5, 1.1), (30, 80)), specks(rng, 45, (0.8, 2.2), (110, 170)))
    pale = ImageChops.lighter(fibres(rng, 600, (4, 18), (0.5, 1.0), (30, 80)), specks(rng, 32, (0.7, 1.8), (70, 120)))
    height = ImageChops.add(ImageChops.subtract(base, dark), pale)
    shift = 128 - round(ImageStat.Stat(height).mean[0])
    return height.point(lambda v: min(255, max(0, v + shift)))


def mottle() -> Image.Image:
    rng = random.Random(29)
    w, h = MOTTLE
    total = Image.new('L', (w, h), 128)
    for cells, weight in ((7, 0.65), (18, 0.35)):
        coarse = Image.new('L', (cells, max(2, round(cells * h / w))))
        coarse.putdata([rng.randint(0, 255) for _ in range(coarse.width * coarse.height)])
        smooth = coarse.resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(w / cells / 3))
        total = Image.blend(total, smooth, weight)
    return total


def save(img: Image.Image, name: str) -> None:
    path = OUT / name
    img.save(path, 'WEBP', quality=70, method=6)
    print('wrote', path.relative_to(ROOT), path.stat().st_size // 1024, 'KiB')


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    save(grain(), 'kraft-grain.webp')
    save(mottle(), 'kraft-mottle.webp')


if __name__ == '__main__':
    main()
