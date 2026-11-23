// Shared coordinates of the box hero, so its layers line up by construction.

export const VB = { w: 1200, h: 760 };
const F = { x: 30, y: 140, w: 1060, h: 600 };
const D = { x: 84, y: -100 };

export type Pt = [number, number];
export const pts = (list: Pt[]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
export const topAt = (u: number, v: number): Pt => [F.x + u * F.w + v * D.x, F.y + v * D.y];
export const sideAt = (v: number, t: number): Pt => [F.x + F.w + v * D.x, F.y + v * D.y + t * F.h];

export const front: Pt[] = [[F.x, F.y], [F.x + F.w, F.y], [F.x + F.w, F.y + F.h], [F.x, F.y + F.h]];
export const top: Pt[] = [topAt(0, 0), topAt(1, 0), topAt(1, 1), topAt(0, 1)];
export const side: Pt[] = [sideAt(0, 0), sideAt(1, 0), sideAt(1, 1), sideAt(0, 1)];
export const silhouette: Pt[] = [topAt(0, 0), topAt(0, 1), topAt(1, 1), sideAt(1, 1), sideAt(0, 1), [F.x, F.y + F.h]];

export const back = { x: F.x + D.x, y: F.y + D.y, w: F.w, h: F.h };
export const frontRect = F;

// Packing tape on the flap seam of the lid, over the edge onto the side.
// Each strip has a flat frame: x runs along the tape, y across it. A face maps that frame onto the view box,
// so the printed brand continues over the box edges.
// The real lid depth in front-face pixels. D is how the camera sees it.
const DEPTH = 265;
export const TAPE = { w: 64, tab: 176, repeat: 260, text: 160 };

export type TapeFace = { face: 'top' | 'side'; m: string; from: number; to: number; cut: boolean };
export type Tape = { anchor: number; faces: TapeFace[] };

const k = { x: D.x / DEPTH, y: D.y / DEPTH };
const mid = F.w / 2;
const matrix = (...m: number[]) => `matrix(${m.map((v) => +v.toFixed(4)).join(' ')})`;

export const tapes: Tape[] = [
  {
    anchor: mid + TAPE.repeat / 2,
    faces: [
      { face: 'top', m: matrix(1, 0, -k.x, -k.y, F.x + D.x / 2, F.y + D.y / 2), from: 0, to: F.w, cut: false },
      {
        face: 'side',
        m: matrix(0, 1, -k.x, -k.y, F.x + F.w + D.x / 2, F.y + D.y / 2 - F.w),
        from: F.w,
        to: F.w + TAPE.tab,
        cut: true,
      },
    ],
  },
];

// A cut end has the zigzag of a dispenser blade.
export const tapeOutline = ({ from, to, cut }: TapeFace): Pt[] => {
  const half = TAPE.w / 2;
  const end: Pt[] = cut
    ? Array.from({ length: 9 }, (_, j) => [to - (j % 2) * 4.8, -half + (j * TAPE.w) / 8])
    : [[to, -half], [to, half]];
  return [[from, -half], ...end, [from, half]];
};

// Every print repeat that is at least partly on the face.
export const tapePrint = (tape: Tape, { from, to }: TapeFace) => {
  const first = Math.ceil((from - TAPE.repeat / 2 - tape.anchor) / TAPE.repeat);
  const last = Math.floor((to + TAPE.repeat / 2 - tape.anchor) / TAPE.repeat);
  return Array.from({ length: last - first + 1 }, (_, i) => tape.anchor + (first + i) * TAPE.repeat);
};

// RW-EZMPTR photo: 1600×900, product bounding box 113,32 → 1218,879.
const s = 540 / 847;
export const photo = { x: 70 - 113 * s, y: 170 - 32 * s, w: 1600 * s, h: 900 * s };
export const sticker = { x: photo.x + 752 * s, y: photo.y + 210 * s, w: 88 * s, h: 26 * s };
// Maps source pixels of the photo onto the view box.
export const photoTransform = `translate(${photo.x.toFixed(2)} ${photo.y.toFixed(2)}) scale(${s.toFixed(5)})`;

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
export const silhouetteClip = `polygon(${silhouette.map(([x, y]) => `${pct(x, VB.w)} ${pct(y, VB.h)}`).join(', ')})`;
export const photoStyle = `left:${pct(photo.x, VB.w)};top:${pct(photo.y, VB.h)};width:${pct(photo.w, VB.w)}`;
export const photoWidths = [480, 720, 960, 1280, 1600];
export const photoSizes = '(min-width: 960px) 62vw, 82vw';
