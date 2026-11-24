// A five-circuit RWKO-PT manifold in stainless steel, measured from the product photo and the side drawing.
// Units are millimetres. x runs along the beams, y points up, z points at the viewer.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PartId } from '../../data/manifold';
import {
  assemble,
  bentBar,
  cylinder,
  fluted,
  memo,
  place,
  placeX,
  prism,
  ridged,
  sBend,
  stack,
  stickerTexture,
  turned,
  type Anchor,
  type ManifoldModel,
} from './manifold-kit';
import { flowMeter, meterScaleMaterial, nipple, thermostaticInsert, type NippleShape } from './manifold-parts';

// The beam is a rectangular tube with rounded corners. Its ends are pressed round, and the bracket clamps hold them.
const HALF_H = 21;
const HALF_D = 20;
const CORNER = 5;
const NECK = 20;
const BODY = 118;
const SHOULDER = 124;
const END = 138;
const SUPPLY_Y = 100;
const RETURN_Y = -100;
// The lower half of each bracket steps forward, so the return beam stands further from the wall.
const SUPPLY_Z = -8;
const RETURN_Z = 8;
const depth = (y: number) => (y > 0 ? SUPPLY_Z : RETURN_Z);
const OUTLETS = [-100, -50, 0, 50, 100];
// The parts on the outlets seat on the outlet bosses.
const SEAT = HALF_H + 1.2;
const BRACKETS = [-128, 128];
const TEE_X = 165;
// The tee arm screws into the beam end, so both have one bore.
const BORE = 14.5;
const bore = () => memo('steel bore', () => new THREE.CircleGeometry(BORE, 40));

// The brackets and clamp bands are bent from the same 1.5 mm sheet. Each band hugs a beam neck, and its flanges lie on
// the bracket.
const SHEET = 1.5;
const BAND = NECK + SHEET / 2;
const STRAP = 9.5;
const strapBehind = (beamZ: number) => beamZ - BAND - SHEET;
// The ends of the bracket and the middle, where the two halves overlap, touch the wall.
const WALL = strapBehind(SUPPLY_Z) - 6;

const SPREAD = 24;
const GAP = 30;
// A part with a long stem lifts further, until the stem clears the beam by this much.
const CLEAR = 16;
const NIPPLE: NippleShape = { hex: [15.3, 4.5], neck: [0, 0], thread: [13, 11.5] };
const TEE_OUT = 46;
const BRACKET_BACK = 70;
// The sticker leaves the beam and floats in the open space between the beams, bigger and turned to the viewer.
const STICKER_AWAY = new THREE.Vector3(0, -64, 50);
const STICKER_GROW = 2.6;
const STICKER_SPIN = -0.35;

// The tube runs along y like the turned parts, so placeX lays it along the beam and the brushing runs lengthwise.
// Each section is the rounded rectangle, the round neck or a blend of both.
const beamBody = () =>
  memo('steel beam', () => {
    const straight = HALF_D - CORNER;
    const arc = (Math.PI * CORNER) / 2;
    const quarter = straight + arc + HALF_H - CORNER;
    const topToFront = (t: number): [number, number] => {
      if (t <= straight) return [HALF_H, t];
      if (t <= straight + arc) {
        const a = (t - straight) / CORNER;
        return [HALF_H - CORNER + CORNER * Math.cos(a), straight + CORNER * Math.sin(a)];
      }
      return [HALF_H - CORNER - (t - straight - arc), HALF_D];
    };
    // Top, front, bottom and back in turn. The other quarters mirror the first one.
    const outline = (s: number): [number, number] => {
      const q = Math.min(3, Math.floor(s / quarter));
      const t = s - q * quarter;
      const [x, z] = topToFront(q % 2 ? quarter - t : t);
      return [q === 1 || q === 2 ? -x : x, q >= 2 ? -z : z];
    };

    const sides = 96;
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const stations: [y: number, round: number][] = [[-END, 1]];
    for (let k = 0; k <= 8; k++) stations.push([-SHOULDER + ((SHOULDER - BODY) * k) / 8, 1 - smooth(k / 8)]);
    for (let k = 0; k <= 8; k++) stations.push([BODY + ((SHOULDER - BODY) * k) / 8, smooth(k / 8)]);
    stations.push([END, 1]);

    const position: number[] = [];
    const ring = (y: number, round: number) => {
      for (let k = 0; k < sides; k++) {
        const [rx, rz] = outline((4 * quarter * k) / sides);
        const a = (2 * Math.PI * k) / sides;
        position.push(rx + (NECK * Math.cos(a) - rx) * round, y, rz + (NECK * Math.sin(a) - rz) * round);
      }
    };
    stations.forEach(([y, round]) => ring(y, round));
    const index: number[] = [];
    for (let i = 0; i < stations.length - 1; i++) {
      for (let k = 0; k < sides; k++) {
        const a = i * sides + k;
        const b = a + sides;
        const c = i * sides + ((k + 1) % sides);
        const d = c + sides;
        index.push(a, b, c, c, b, d);
      }
    }
    // The end faces get their own vertices, so they stay flat.
    for (const sign of [-1, 1]) {
      const centre = position.length / 3;
      position.push(0, sign * END, 0);
      ring(sign * END, 1);
      for (let k = 0; k < sides; k++) {
        const a = centre + 1 + k;
        const b = centre + 1 + ((k + 1) % sides);
        index.push(...(sign < 0 ? [centre, a, b] : [centre, b, a]));
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    return geometry;
  });

// A flat part of the bracket, drawn in x and y and centred on its mid plane.
function plate(key: string, bottom: number, top: number, [rBottom, rTop]: [number, number], holes: THREE.Path[]) {
  return memo(`steel plate ${key}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-STRAP, bottom + rBottom);
    if (rBottom) s.absarc(-STRAP + rBottom, bottom + rBottom, rBottom, Math.PI, Math.PI * 1.5, false);
    s.lineTo(STRAP - rBottom, bottom);
    if (rBottom) s.absarc(STRAP - rBottom, bottom + rBottom, rBottom, Math.PI * 1.5, Math.PI * 2, false);
    s.lineTo(STRAP, top - rTop);
    if (rTop) s.absarc(STRAP - rTop, top - rTop, rTop, 0, Math.PI / 2, false);
    s.lineTo(-STRAP + rTop, top);
    if (rTop) s.absarc(-STRAP + rTop, top - rTop, rTop, Math.PI / 2, Math.PI, false);
    s.closePath();
    s.holes.push(...holes);
    const bevel = 0.35;
    const geometry = new THREE.ExtrudeGeometry(s, {
      depth: SHEET - 2 * bevel,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelOffset: -bevel,
      bevelSegments: 1,
      curveSegments: 20,
    });
    geometry.translate(0, 0, -(SHEET - 2 * bevel) / 2);
    return geometry;
  });
}

const hole = (y: number, r: number) => new THREE.Path().absarc(0, y, r, 0, Math.PI * 2, false);

const slot = (bottom: number, top: number, r: number) => {
  const path = new THREE.Path();
  path.moveTo(r, bottom + r);
  path.lineTo(r, top - r);
  path.absarc(0, top - r, r, 0, Math.PI, false);
  path.lineTo(-r, bottom + r);
  path.absarc(0, bottom + r, r, Math.PI, Math.PI * 2, false);
  return path;
};

// The band runs down the upper flange, bends forward, wraps the front of the neck and returns to the lower flange.
const clampPath = (beamY: number, beamZ: number, up: number, down: number) => {
  const flange = beamZ - BAND;
  const bend = 2;
  const path: [y: number, z: number][] = [[beamY + up, flange]];
  for (let k = 0; k <= 4; k++) {
    const a = (k / 4) * (Math.PI / 2);
    path.push([beamY + BAND + bend - bend * Math.sin(a), flange + bend - bend * Math.cos(a)]);
  }
  for (let k = 0; k <= 24; k++) {
    const a = (k / 24) * Math.PI;
    path.push([beamY + BAND * Math.cos(a), beamZ + BAND * Math.sin(a)]);
  }
  for (let k = 0; k <= 4; k++) {
    const a = (k / 4) * (Math.PI / 2);
    path.push([beamY - BAND - bend + bend * Math.cos(a), flange + bend - bend * Math.sin(a)]);
  }
  path.push([beamY - down, flange]);
  return path;
};

const cross = () =>
  memo('steel cross', () =>
    mergeGeometries(
      [Math.PI / 4, -Math.PI / 4].map((turn) => new THREE.BoxGeometry(5.4, 0.9, 0.6).rotateZ(turn)),
    ),
  );

export function buildSteel(): ManifoldModel {
  const { add, paint, track, label, sticker, slot: slotMaterial, finish } = assemble();

  const beam = (part: PartId, y: number, text: string, color: string, labelY: number) => {
    const m = paint(part);
    const g = new THREE.Group();
    g.position.set(0, y, depth(y));
    placeX(g, beamBody(), m('steel'), 0);
    for (const side of [-1, 1]) {
      place(g, bore(), m('socket'), side * (END + 0.05)).rotation.y = (side * Math.PI) / 2;
    }
    const plug = place(g, memo('steel plug', () => new THREE.TorusGeometry(17.2, 1.3, 12, 48)), m('black'), -END - 0.6);
    plug.rotation.y = Math.PI / 2;
    const ring = place(g, memo('steel seal', () => new THREE.TorusGeometry(18.4, 1.6, 12, 48)), m('black'), END + 1.6);
    ring.rotation.y = Math.PI / 2;
    for (const x of OUTLETS) {
      for (const side of [1, -1]) {
        place(g, cylinder(12, 1.6, 32), m('steel'), x, side * (HALF_H + 0.4));
        place(g, cylinder(9.3, 0.4, 32), m('socket'), x, side * (HALF_H + 1.25));
      }
    }
    const sign = label(part, text, color, 580);
    place(g, memo('steel label', () => new THREE.PlaneGeometry(24.6, 8.5)), sign, -100, labelY, HALF_D + 0.3);
    return add(part, g, new THREE.Vector3(0, y > 0 ? SPREAD : -SPREAD, 0));
  };

  const supply = beam('zasilanie', SUPPLY_Y, 'ZASILANIE', '#c8201c', 5);
  const ret = beam('powrot', RETURN_Y, 'POWRÓT', '#1f3fa6', 0);

  // The sticker sits where the real product carries the Huber label.
  const stickerPlane = memo('steel sticker', () => new THREE.PlaneGeometry(42, 14));
  const brandGroup = new THREE.Group();
  brandGroup.position.set(0, SUPPLY_Y, SUPPLY_Z);
  place(brandGroup, stickerPlane, sticker, 0, 3, HALF_D + 0.4);
  add('oznaczenie', brandGroup, STICKER_AWAY, { grow: STICKER_GROW, spin: STICKER_SPIN });
  place(supply, stickerPlane, slotMaterial, 0, 3, HALF_D + 0.2).userData.part = 'oznaczenie';

  const scale = track('rotametry', meterScaleMaterial());
  const flowmeters = OUTLETS.map((x) => {
    const { group, reach } = flowMeter(paint('rotametry'), scale);
    group.position.set(x, SUPPLY_Y + SEAT, SUPPLY_Z);
    return add('rotametry', group, new THREE.Vector3(0, SPREAD + CLEAR + reach, 0));
  });

  const caps = OUTLETS.map((x) => {
    const { group, reach } = thermostaticInsert(paint('wkladki'));
    group.position.set(x, RETURN_Y + SEAT, RETURN_Z);
    return add('wkladki', group, new THREE.Vector3(0, -SPREAD + CLEAR + reach, 0));
  });

  const nipples = [SUPPLY_Y, RETURN_Y].flatMap((y) =>
    OUTLETS.map((x) => {
      const group = nipple(paint('przylacza'), 'nickel', NIPPLE);
      group.position.set(x, y - SEAT, depth(y));
      return add('przylacza', group, new THREE.Vector3(0, (y > 0 ? SPREAD : -SPREAD) - GAP, 0), { zone: `przylacza ${y}` });
    }),
  );

  // Each bracket is two halves that overlap in the middle, so the beam spacing can change.
  const brackets = BRACKETS.map((x) => {
    const m = paint('uchwyty');
    const g = new THREE.Group();
    g.position.x = x;
    const out = Math.sign(x) * 2;
    const supplyStrap = strapBehind(SUPPLY_Z);
    const returnStrap = strapBehind(RETURN_Z);

    place(g, plate('top', 144, 163, [0, STRAP], [hole(153.5, 4.5)]), m('chrome'), 0, 0, WALL);
    const upper = () =>
      bentBar(
        [...sBend([144, WALL], [139, supplyStrap], 8), ...sBend([56, supplyStrap], [51.6, WALL], 8)],
        STRAP * 2,
        SHEET,
      );
    place(g, memo('steel strap upper', upper), m('chrome'));
    place(g, plate('middle', -42, 51.6, [0, 0], [slot(-36, 39.4, 4)]), m('chrome'), 0, 0, WALL);

    const slots = [slot(-8.8, 6.1, 4), slot(-34.4, -22, 4)];
    place(g, plate('lower', -45.5, 13.3, [0, 3], slots), m('chrome'), 0, 0, WALL + SHEET);
    const lower = () =>
      bentBar(
        [
          ...sBend([-45.5, WALL + SHEET], [-53.6, returnStrap], 10),
          ...sBend([-138.8, returnStrap], [-150.3, WALL], 10),
        ],
        STRAP * 2,
        SHEET,
      );
    place(g, memo('steel strap lower', lower), m('chrome'));
    place(g, plate('bottom', -173.7, -150.3, [STRAP, 0], [hole(-164.2, 4.7)]), m('chrome'), 0, 0, WALL);

    const screw = (sx: number, sy: number, face: number) => {
      const head = place(g, cylinder(4.2, 2, 24), m('chrome'), sx, sy, face + 1);
      head.rotation.x = Math.PI / 2;
      place(g, cross(), m('black'), sx, sy, face + 2.1);
    };
    screw(0, 2.2, WALL + 1.5 * SHEET);
    screw(0, -33.1, WALL + 1.5 * SHEET);

    for (const [beamY, beamZ, up, down] of [
      [SUPPLY_Y, SUPPLY_Z, 38, 43],
      [RETURN_Y, RETURN_Z, 45, 38],
    ]) {
      const band = () => bentBar(clampPath(beamY, beamZ, up, down), 13, SHEET);
      place(g, memo(`steel clamp ${beamY}`, band), m('chrome'), out);
      for (const dy of [30, -30]) screw(out, beamY + dy, beamZ - BAND + SHEET / 2);
    }
    return add('uchwyty', g, new THREE.Vector3(0, 0, -BRACKET_BACK), { zone: `uchwyty ${x}` });
  });

  const mark = stickerTexture(128, 192, (ctx) => {
    ctx.translate(64, 96);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(58, 54, 48, 0.85)';
    ctx.font = '700 96px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PH', 0, 6);
  });
  const markMaterial = new THREE.MeshStandardMaterial({ map: mark.texture, transparent: true, roughness: 0.5 });
  track('trojnik', markMaterial);

  const tees = [SUPPLY_Y, RETURN_Y].map((y) => {
    const shift = y > 0 ? SPREAD : -SPREAD;

    const m = paint('trojnik');
    const tee = new THREE.Group();
    tee.position.set(TEE_X, y, depth(y));
    placeX(tee, prism(21.9, 21.9, 8.5, 6), m('nickel'), 145.25 - TEE_X);
    placeX(tee, cylinder(13.5, 9), m('nickel'), 154 - TEE_X);
    place(tee, memo('steel boss', () => new THREE.BoxGeometry(8.5, 19, 2)), m('nickel'), 154 - TEE_X, 0, 13);
    place(tee, memo('steel mark', () => new THREE.PlaneGeometry(6, 9)), markMaterial, 154 - TEE_X, 0, 14.05);
    const body = memo('steel tee body', () =>
      turned(
        [
          [0, -21.8],
          [12, -21.8],
          [12.8, -21],
          [12.8, -12],
          [12.3, -11],
          [12.3, 11],
          [12.8, 12],
          [12.8, 21],
          [12, 21.8],
          [0, 21.8],
        ],
        48,
        false,
      ),
    );
    place(tee, body, m('nickel'));
    const bottom = stack(tee, -21.8, -1, [[prism(12.6, 12.6, 7.7, 6), m('nickel'), 7.7]]);
    place(tee, bore(), m('socket'), 141 - 0.05 - TEE_X).rotation.y = -Math.PI / 2;
    place(tee, cylinder(8, 0.4, 32), m('socket'), 0, 21.85);
    place(tee, cylinder(7.2, 0.4, 32), m('socket'), 0, bottom - 0.05);
    add('trojnik', tee, new THREE.Vector3(TEE_OUT, shift, 0), { zone: `trojnik ${y}` });

    const v = paint('odpowietrznik');
    const vent = new THREE.Group();
    vent.position.set(TEE_X, y + 21.8, depth(y));
    stack(vent, 0, -1, [[ridged(9, 6, 1.4, 0.7), v('nickel'), 6]]);
    stack(vent, 0, 1, [
      [prism(12.4, 12.4, 18, 6), v('nickel'), 18],
      [cylinder(13.5, 44.5), v('chrome'), 44.5],
      [cylinder(15.8, 1.2), v('chrome'), 1.2],
      [fluted(16.2, 0.35, 9.6, 96), v('chrome'), 9.6],
      [cylinder(15.8, 1.2), v('chrome'), 1.2],
      [prism(5.6, 6.8, 9, 16), v('black'), 9],
      [cylinder(4.8, 2.2, 24), v('black'), 2.2],
    ]);
    add('odpowietrznik', vent, new THREE.Vector3(TEE_OUT, shift + GAP, 0), { zone: `odpowietrznik ${y}` });

    const drain = new THREE.Group();
    drain.position.set(TEE_X, y - 29.5, depth(y));
    stack(drain, 0, 1, [[ridged(8, 6, 1.4, 0.8), m('nickel'), 6]]);
    const elbow = memo('steel drain body', () =>
      turned(
        [
          [0, -22.5],
          [8, -22.5],
          [10.4, -21.4],
          [11.5, -19],
          [11.5, 0],
          [0, 0],
        ],
        40,
        false,
      ),
    );
    place(drain, elbow, m('black'));
    const dir = new THREE.Vector3(0.72, -0.42, 0.55).normalize();
    const along = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const pivot = new THREE.Vector3(0, -12, 0);
    for (const [geometry, at] of [
      [cylinder(7.5, 18), 12],
      [fluted(12.5, 0.7, 13, 28), 25],
    ] as const) {
      const mesh = place(drain, geometry, m('black'));
      mesh.position.copy(pivot).addScaledVector(dir, at);
      mesh.quaternion.copy(along);
    }
    const loop = memo('steel drain strap', () => new THREE.TorusGeometry(8.5, 0.9, 6, 32, Math.PI * 1.2));
    const strap = place(drain, loop, m('black'));
    strap.position.copy(pivot).addScaledVector(dir, 17).add(new THREE.Vector3(-4, -9, 0));
    strap.rotation.set(0, Math.PI / 2.6, Math.PI * 0.9);
    place(drain, cylinder(2, 5, 16), m('chrome'), -2.5, -24.5, 3);
    add('trojnik', drain, new THREE.Vector3(TEE_OUT, shift - GAP, 0), { zone: `trojnik ${y}` });

    return { tee, vent, drain };
  });

  const anchors: Record<PartId, Anchor> = {
    rotametry: { object: flowmeters[0], point: new THREE.Vector3(-14.3, 12, 0) },
    odpowietrznik: { object: tees[0].vent, point: new THREE.Vector3(16.2, 68.5, 0) },
    zasilanie: { object: supply, point: new THREE.Vector3(-END, 0, 8) },
    oznaczenie: { object: brandGroup, point: new THREE.Vector3(25.5, 3, HALF_D + 0.4) },
    uchwyty: { object: brackets[0], point: new THREE.Vector3(-STRAP, 25, WALL) },
    wkladki: { object: caps[0], point: new THREE.Vector3(-16.5, 12, 0) },
    powrot: { object: ret, point: new THREE.Vector3(-END, 0, 8) },
    trojnik: { object: tees[1].tee, point: new THREE.Vector3(12.8, 0, 0) },
    przylacza: { object: nipples[OUTLETS.length], point: new THREE.Vector3(-13, -10, 0) },
  };

  const trail: [Anchor, Anchor] = [
    { object: supply, point: new THREE.Vector3(0, 3 - 7, HALF_D + 0.2) },
    { object: brandGroup, point: new THREE.Vector3(0, 3 + 7, HALF_D + 0.4) },
  ];

  return finish(anchors, trail);
}
