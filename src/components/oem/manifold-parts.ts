// Parts that both manifolds share.
// Units are millimetres. Each part stands along y with y = 0 on its seat. The flow meter and the insert reach down into
// the beam, the nipple reaches up into it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cylinder, memo, place, prism, ridged, stack, stickerTexture, turned, type Finish } from './manifold-kit';

type Paint = (finish: Finish) => THREE.Material;

export interface Part {
  group: THREE.Group;
  // How far the part reaches into the beam below its seat.
  reach: number;
}

export interface NippleShape {
  hex: [r: number, h: number];
  neck: [r: number, h: number];
  thread: [crest: number, h: number];
}

export const oRing = (r: number, tube: number) =>
  memo(`o-ring ${r} ${tube}`, () => new THREE.TorusGeometry(r, tube, 10, 40).rotateX(Math.PI / 2));

// With a face to the front.
const meterNut = () =>
  memo('meter nut', () =>
    turned(
      [
        [0, -9.5],
        [15, -9.5],
        [15.5, -9],
        [15.5, 7],
        [13.8, 9.5],
        [0, 9.5],
      ],
      8,
      true,
    ).rotateY(Math.PI / 8),
  );

const meterScale = () =>
  memo('meter scale', () => new THREE.CylinderGeometry(7.4, 7.4, 20, 12, 1, true, -0.55, 1.1));

const meterPosts = () =>
  memo('meter posts', () =>
    mergeGeometries(
      Array.from({ length: 4 }, (_, k) =>
        new THREE.BoxGeometry(2.4, 3, 1.6).translate(0, 0, 6.6).rotateY((k * Math.PI) / 2),
      ),
    ),
  );

const meterStem = () =>
  memo('meter stem', () =>
    turned(
      [
        [0, -9],
        [3.9, -9],
        [5, -8.6],
        [5.45, -7.5],
        [5.45, 9],
        [0, 9],
      ],
      32,
      false,
    ),
  );

const insertTip = () =>
  memo('insert tip', () =>
    turned(
      [
        [0, -1.4],
        [0.4, -1.4],
        [1.5, 1.4],
        [0, 1.4],
      ],
      16,
      false,
    ),
  );

// A thread from y0 up to y1, root to root. The margin keeps a rounding error from adding a crest at y1.
const threadSteps = (crest: number, root: number, pitch: number, y0: number, y1: number) => {
  const points: [radius: number, y: number][] = [[root, y0]];
  for (let k = 1; y0 + (k * pitch) / 2 < y1 - 1e-6; k++) points.push([k % 2 ? crest : root, y0 + (k * pitch) / 2]);
  points.push([root, y1]);
  return points;
};

// The ¾″ end opens in a cone for the pipe fitting.
const nippleTube = ({ hex: [, hexH], neck: [neckR, neckH], thread: [crest, threadH] }: NippleShape) =>
  memo(`nipple tube ${hexH} ${neckR} ${neckH} ${crest} ${threadH}`, () => {
    const end = -(hexH + neckH + threadH);
    const root = crest - 0.8;
    const neck: [radius: number, y: number][] = neckH
      ? [
          [neckR, -(hexH + neckH)],
          [neckR, -hexH],
        ]
      : [];
    return turned(
      [
        [9.6, end],
        [crest - 1.2, end],
        [root, end + 0.4],
        ...threadSteps(crest, root, 1.8, end + 0.4, -(hexH + neckH)),
        ...neck,
        [11, -hexH],
        [11, 0],
        [9.7, 0],
        ...threadSteps(10.4, 9.7, 1.8, 2.3, 7.4),
        [9.2, 8],
        [7.2, 8],
        [7.2, end + 4],
        [9.6, end],
      ],
      48,
      false,
    );
  });

// A ring round the tube, so the bore stays open.
const nippleHex = ([r, h]: NippleShape['hex']) =>
  memo(`nipple hex ${r} ${h}`, () =>
    turned(
      [
        [10.5, -h / 2],
        [r - 0.8, -h / 2],
        [r, -h / 2 + 0.8],
        [r, h / 2 - 0.8],
        [r - 0.8, h / 2],
        [10.5, h / 2],
        [10.5, -h / 2],
      ],
      6,
      true,
    ),
  );

// A new material on each call: each model tracks its own, so a highlight can fade it.
export function meterScaleMaterial() {
  const { texture } = stickerTexture(104, 256, (ctx) => {
    ctx.fillStyle = '#1c1d22';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '700 30px Arial, sans-serif';
    for (let k = 0; k <= 8; k++) {
      const y = 10 + k * 29.5;
      ctx.fillRect(k % 2 ? 72 : 60, y - (k % 2 ? 1.5 : 2.5), k % 2 ? 22 : 36, k % 2 ? 3 : 5);
      if (k % 2 === 0) ctx.fillText(String(k / 2), 54, y + 2);
    }
  });
  return new THREE.MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, roughness: 0.5 });
}

export function flowMeter(m: Paint, scale: THREE.Material): Part {
  const group = new THREE.Group();
  const tip = stack(group, 0, -1, [
    [cylinder(9.6, 1.7), m('brass'), 1.7],
    [ridged(10.5, 6, 1.8, 0.7), m('brass'), 6],
    [cylinder(7.4, 3), m('brass'), 3],
    [cylinder(6.2, 3, 24), m('red'), 3],
    [cylinder(7.85, 8.5), m('brass'), 8.5],
    [cylinder(8.45, 5.8), m('brass'), 5.8],
    [cylinder(7.7, 3.6), m('black'), 3.6],
    [meterStem(), m('red'), 18],
  ]);
  place(group, oRing(10.6, 0.9), m('black'), 0, -1);
  place(group, meterPosts(), m('brass'), 0, -12.2);
  place(group, oRing(6.6, 0.7), m('black'), 0, -13.3);
  const top = stack(group, 0, 1, [
    [cylinder(13.6, 1.6), m('brass'), 1.6],
    [meterNut(), m('red'), 19],
    [cylinder(7.4, 7.7, 32), m('red'), 7.7],
  ]);
  // The tabs point diagonally, so they show from the front and clear the bracket clamps.
  place(group, memo('meter tabs', () => new THREE.BoxGeometry(7, 2.2, 40).rotateY(Math.PI / 4)), m('red'), 0, 2.7);
  stack(group, top, 1, [
    [cylinder(7.3, 26.2, 32), m('glass'), 26.2],
    [cylinder(7.6, 1.5, 32), m('glass'), 1.5],
  ]);
  place(group, cylinder(1, 21, 12), m('black'), 0, top + 10.5);
  // The float stands at zero.
  place(group, cylinder(5.8, 1.4, 32), m('red'), 0, top + 20.2);
  place(group, meterScale(), scale, 0, top + 11.5);
  return { group, reach: -tip };
}

export function thermostaticInsert(m: Paint): Part {
  const group = new THREE.Group();
  const tip = stack(group, 0, -1, [
    [cylinder(12, 2.5), m('brass'), 2.5],
    [cylinder(9.6, 2.6), m('brass'), 2.6],
    [ridged(10.4, 5.2, 1.8, 0.7), m('brass'), 5.2],
    [cylinder(5.6, 2.2, 24), m('brass'), 2.2],
    [cylinder(1.65, 14.6, 16), m('chrome'), 14.6],
    [cylinder(3.6, 2.2, 24), m('brass'), 2.2],
    [cylinder(7.4, 3), m('brass'), 3],
    [cylinder(7, 1.4), m('black'), 1.4],
    [insertTip(), m('chrome'), 2.8],
  ]);
  place(group, oRing(10.2, 1.3), m('black'), 0, -3.8);
  stack(group, 0, 1, [
    [cylinder(15, 2.6), m('brass'), 2.6],
    [prism(16.5, 16.5, 18, 8), m('navy'), 18],
    [prism(11, 16.5, 6, 8), m('navy'), 6],
  ]);
  group.rotation.y = Math.PI / 8;
  return { group, reach: -tip };
}

// ½″ into the beam, ¾″ for the loop.
export function nipple(m: Paint, finish: Finish, shape: NippleShape) {
  const group = new THREE.Group();
  place(group, nippleTube(shape), m(finish));
  place(group, nippleHex(shape.hex), m(finish), 0, -shape.hex[1] / 2);
  place(group, oRing(10.3, 1.1), m('black'), 0, 1.2);
  return group;
}
