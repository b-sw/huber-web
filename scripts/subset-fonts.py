"""Cut the Archivo variable font down to the glyphs and axis ranges the site uses.

Polish text needs Basic Latin, Latin-1 punctuation and 18 letters from Latin Extended-A.
The page uses weights 400–800 and widths 72–100%, so the rest of each axis is dropped.

Usage: python3 scripts/subset-fonts.py
"""

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'node_modules/@fontsource-variable/archivo/files'
TARGET = ROOT / 'src/assets/fonts'

RANGES = {
    'latin': 'U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201E,U+2026,U+2032-2033,U+20AC,U+2190-2193',
    'latin-ext': 'U+0104-0107,U+0118-0119,U+0141-0144,U+015A-015B,U+0179-017C',
}
AXES = {'wght': (400, 800), 'wdth': (72, 100)}


def unicodes(spec: str) -> list[int]:
    points = []
    for part in spec.split(','):
        start, _, end = part.removeprefix('U+').partition('-')
        points.extend(range(int(start, 16), int(end or start, 16) + 1))
    return points


def main() -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    for name, spec in RANGES.items():
        font = TTFont(SOURCE / f'archivo-{name}-wdth-normal.woff2')
        font = instancer.instantiateVariableFont(font, AXES)
        options = subset.Options()
        options.flavor = 'woff2'
        options.layout_features = ['kern', 'liga', 'calt', 'tnum', 'lnum']
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=unicodes(spec))
        subsetter.subset(font)
        out = TARGET / f'archivo-{name}.woff2'
        font.flavor = 'woff2'
        font.save(out)
        print(f'{out.relative_to(ROOT)}: {out.stat().st_size // 1024} KiB ({spec})')


if __name__ == '__main__':
    main()
