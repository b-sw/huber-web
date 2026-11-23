"""Turn the technical drawings from the live product pages into transparent line art.

The page draws the dimension lines (L, H, G and the 50 mm outlet pitch) as HTML, so they stay sharp and readable at
any size. This script erases them from each drawing, makes the white paper transparent and crops the drawing.
It writes one PNG per product and the dimension positions, in percent of the cropped drawing, to
src/data/drawings.json.

A dimension without "at" sits outside the drawing: below it for the x axis, on its right for the y axis.

Usage: python3 scripts/drawings.py
"""

import io
import json
import urllib.request
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageMath

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / 'src/assets/drawings'
DATA = ROOT / 'src/data/drawings.json'
LIVE = 'https://www.huber.info.pl/wp-content/uploads/'

# Measured on the source drawings, in source pixels.
# L and G: (left tip, right tip, y). G shares the y of L.
# H: (x, top tip, bottom tip, first column, last column). The columns, plus 3 px of anti-aliasing on each side,
# hold only the H line and its letter.
# pitch: (left tick, right tick, y, erase box).
# specks: boxes around loose centreline dots that read as dirt once the drawing is cropped.
DRAWINGS = {
    'rw-pt': {'src': '2025/02/tech-rw-pt.jpg', 'L': (42, 593, 640), 'G': (705, 838), 'H': (674, 15, 592, 666, 680)},
    'rw-ptpex': {'src': '2025/02/tech-rw-ptpex.jpg', 'L': (41, 595, 642), 'G': (707, 841), 'H': (676, 15, 595, 668, 682)},
    'rw-ptr': {'src': '2017/06/RW-PTRtech1.jpg', 'L': (16, 686, 894), 'G': (821, 983), 'H': (784, 135, 837, 774, 791)},
    'rw-zz': {'src': '2017/06/tech-RW-ZZ.jpg', 'L': (43, 691, 896), 'G': (807, 964), 'H': (758, 144, 826, 749, 765)},
    'rw-zz0': {'src': '2017/06/tech-RW-ZZ0.jpg', 'L': (88, 605, 871), 'G': (776, 933), 'H': (665, 232, 812, 656, 673)},
    'rw-zzr': {'src': '2017/06/RW-ZZRtech.jpg', 'L': (43, 691, 896), 'G': (807, 964), 'H': (758, 145, 826, 749, 765)},
    'rw-ezmpt': {'src': '2017/06/tech-RW-EZMPT-1.jpg', 'L': (13, 916, 867), 'H': (982, 166, 815, 972, 988)},
    'rw-ezmptr': {'src': '2017/06/RW-EZMPTRtech.jpg', 'L': (13, 917, 867), 'H': (981, 166, 815, 972, 988)},
    'rwko-pt': {
        'src': '2025/02/tech-rwko-pt.jpg',
        'L': (36, 620, 642),
        'G': (665, 805),
        'H': (843, 29, 599, 832, 855),
        'pitch': (196, 266, 253, (192, 238, 271, 300)),
    },
    'rwko-ptpex': {
        'src': '2025/02/tech-rwko-ptpex.jpg',
        'L': (31, 614, 638),
        'G': (660, 799),
        'H': (838, 25, 594, 826, 850),
        'pitch': (187, 259, 257, (183, 242, 263, 304)),
    },
    'rwko-ptr': {
        'src': '2025/02/tech-rwko-ptr.jpg',
        'L': (26, 609, 623),
        'G': (655, 795),
        'H': (841, 37, 581, 829, 853),
        'pitch': (186, 254, 233, (182, 219, 258, 281)),
        'specks': [(582, 20, 592, 28), (8, 490, 16, 501)],
    },
    'rwko-ptrpex': {
        'src': '2025/02/tech-rwko-ptrpex.jpg',
        'L': (25, 608, 623),
        'G': (654, 794),
        'H': (840, 37, 581, 829, 853),
        'pitch': (181, 254, 240, (177, 226, 258, 290)),
        'specks': [(580, 20, 591, 28), (7, 491, 16, 501)],
    },
}

# Pixels lighter than this are paper or JPEG noise.
PAPER = 16


def fetch(path: str) -> Image.Image:
    with urllib.request.urlopen(LIVE + path) as response:
        return Image.open(io.BytesIO(response.read())).convert('RGB')


def erase(image: Image.Image, spec: dict) -> None:
    draw = ImageDraw.Draw(image)
    white = (255, 255, 255)
    draw.rectangle((0, spec['L'][2] - 14, image.width, image.height), fill=white)
    _, top, bottom, first, last = spec['H']
    draw.rectangle((first - 3, top - 8, last + 3, bottom + 8), fill=white)
    if 'pitch' in spec:
        draw.rectangle(spec['pitch'][3], fill=white)
    for box in spec.get('specks', []):
        draw.rectangle(box, fill=white)


def paper_to_alpha(image: Image.Image) -> Image.Image:
    """Remove white the way a colour-to-alpha filter does, so the red and blue arrows keep their colour."""
    r, g, b = image.split()
    ink = ImageChops.invert(ImageChops.darker(ImageChops.darker(r, g), b))
    alpha = ink.point(lambda v: 0 if v < PAPER else round((v - PAPER) * 255 / (255 - PAPER)))
    safe = ink.point(lambda v: max(v, 1))
    channels = [
        ImageMath.lambda_eval(lambda e: e['convert'](255 - (255 - e['c']) * 255 / e['a'], 'L'), c=c, a=safe)
        for c in (r, g, b)
    ]
    return Image.merge('RGBA', (*channels, alpha))


def pct(value: float, start: int, size: int) -> float:
    return round((value - start) * 100 / size, 2)


def main() -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    data = {}
    for slug, spec in DRAWINGS.items():
        image = fetch(spec['src'])
        erase(image, spec)
        art = paper_to_alpha(image)
        left, top, right, bottom = art.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
        art.crop((left, top, right, bottom)).save(TARGET / f'{slug}.png', optimize=True)
        width, height = right - left, bottom - top

        x1, x2, _ = spec['L']
        dims = [{'label': 'L', 'axis': 'x', 'from': pct(x1, left, width), 'to': pct(x2, left, width)}]
        if 'G' in spec:
            g1, g2 = spec['G']
            dims.append({'label': 'G', 'axis': 'x', 'from': pct(g1, left, width), 'to': pct(g2, left, width)})
        hx, h1, h2, _, _ = spec['H']
        h = {'label': 'H', 'axis': 'y', 'from': pct(h1, top, height), 'to': pct(h2, top, height)}
        if hx < right:
            h['at'] = pct(hx, left, width)
        dims.append(h)
        if 'pitch' in spec:
            p1, p2, py, _ = spec['pitch']
            dims.append({
                'label': '50',
                'axis': 'x',
                'from': pct(p1, left, width),
                'to': pct(p2, left, width),
                'at': pct(py, top, height),
            })
        data[slug] = dims
        print(f'{slug}: {width}x{height}')

    DATA.write_text(json.dumps(data, indent=2) + '\n')


if __name__ == '__main__':
    main()
