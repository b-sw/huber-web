// Shared drawing frame of the box hero. The carton (BoxStage) and its X-ray (XrayLayer) use the same
// numbers, so the halftone print and the real photo line up by construction.

export const VB = { w: 1200, h: 760 };
const F = { x: 30, y: 140, w: 1060, h: 600 };
const D = { x: 84, y: -72 };

export type Pt = [number, number];
export const pts = (list: Pt[]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
export const topAt = (u: number, v: number): Pt => [F.x + u * F.w + v * D.x, F.y + v * D.y];
export const sideAt = (v: number, t: number): Pt => [F.x + F.w + v * D.x, F.y + v * D.y + t * F.h];

export const front: Pt[] = [[F.x, F.y], [F.x + F.w, F.y], [F.x + F.w, F.y + F.h], [F.x, F.y + F.h]];
export const top: Pt[] = [topAt(0, 0), topAt(1, 0), topAt(1, 1), topAt(0, 1)];
export const side: Pt[] = [sideAt(0, 0), sideAt(1, 0), sideAt(1, 1), sideAt(0, 1)];
export const silhouette: Pt[] = [topAt(0, 0), topAt(0, 1), topAt(1, 1), sideAt(1, 1), sideAt(0, 1), [F.x, F.y + F.h]];
export const tapeTop: Pt[] = [topAt(0, 0.38), topAt(1, 0.38), topAt(1, 0.62), topAt(0, 0.62)];
// The cut end of the tape on the side face: the zigzag of a dispenser blade.
export const tapeEnd: Pt[] = Array.from({ length: 9 }, (_, k) => sideAt(0.62 - (k * 0.24) / 8, 0.2 + (k % 2) * 0.008));
export const tapeSide: Pt[] = [sideAt(0.38, 0), sideAt(0.62, 0), ...tapeEnd];
export const back = { x: F.x + D.x, y: F.y + D.y, w: F.w, h: F.h };
export const frontRect = F;

// RW-EZMPTR photo: 1600×900, product bounding box 113,32 → 1218,879.
const s = 540 / 847;
export const photo = { x: 70 - 113 * s, y: 170 - 32 * s, w: 1600 * s, h: 900 * s };
export const sticker = { x: photo.x + 752 * s, y: photo.y + 210 * s, w: 88 * s, h: 26 * s };
export const productBox = { x1: 70, x2: 70 + 1105 * s, y1: 170, y2: 170 + 847 * s };

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
export const silhouetteClip = `polygon(${silhouette.map(([x, y]) => `${pct(x, VB.w)} ${pct(y, VB.h)}`).join(', ')})`;
export const photoStyle = `left:${pct(photo.x, VB.w)};top:${pct(photo.y, VB.h)};width:${pct(photo.w, VB.w)}`;
export const photoWidths = [480, 720, 960, 1280, 1600];
export const photoSizes = '(min-width: 960px) 62vw, 82vw';
