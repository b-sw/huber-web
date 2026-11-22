// A five-circuit RW-PT manifold built from primitives, measured from the product photo.
// Units are millimetres. x runs along the beams, y points up, z points at the viewer.
import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PartId } from '../../data/manifold';
import {
  assemble,
  bentBar,
  cylinder,
  memo,
  place,
  placeX,
  prism,
  ridged,
  sBend,
  stack,
  type Anchor,
  type ManifoldModel,
} from './manifold-kit';

const R = 20;
// Seen end on, the beam is round at the front and back and flat on top and bottom for the outlets.
const FLAT_Y = 18;
const FLAT_HALF_WIDTH = 13.5;
const L = 260;
const END = L / 2;
const SUPPLY_Y = 120;
const RETURN_Y = -120;
// As in the side drawing, the return beam stands further from the wall than the supply beam.
const SUPPLY_Z = -10;
const RETURN_Z = 10;
const BAR_OFFSET = R + 4;
const WALL_Z = SUPPLY_Z - BAR_OFFSET - 12;
const depth = (y: number) => (y > 0 ? SUPPLY_Z : RETURN_Z);
const OUTLETS = [-100, -50, 0, 50, 100];
const BRACKETS = [-75, 75];
const TEE_X = END + 28;

const SPREAD = 24;
const GAP = 30;
const TEE_OUT = 46;
const BRACKET_BACK = 70;
// The sticker leaves the beam and floats in the open space between the beams, bigger and turned to the viewer.
const STICKER_AWAY = new THREE.Vector3(0, -108, 50);
const STICKER_GROW = 2.6;
const STICKER_SPIN = -0.35;

// Path x is height and path y is depth.
// The flats are wider than the round allows, so a short step joins each flat to the round.
function beamProfile<T extends THREE.Path>(path: T, grow: number): T {
  const r = R + grow;
  const flat = FLAT_Y + grow;
  const halfWidth = FLAT_HALF_WIDTH + grow;
  const roundStart = Math.sqrt(r * r - halfWidth * halfWidth);
  const turn = Math.atan2(halfWidth, roundStart);
  path.moveTo(flat, -halfWidth);
  path.lineTo(flat, halfWidth);
  path.lineTo(roundStart, halfWidth);
  path.absarc(0, 0, r, turn, Math.PI - turn, false);
  path.lineTo(-flat, halfWidth);
  path.lineTo(-flat, -halfWidth);
  path.lineTo(-roundStart, -halfWidth);
  path.absarc(0, 0, r, Math.PI + turn, 2 * Math.PI - turn, false);
  return path;
}

function alongBeam(shape: THREE.Shape, length: number, chamfer: number) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: length - 2 * chamfer,
    bevelEnabled: chamfer > 0,
    bevelThickness: chamfer,
    bevelSize: chamfer,
    bevelOffset: -chamfer,
    bevelSegments: 1,
    curveSegments: 24,
  });
  // Along y like the turned parts, so placeX lays it along the beam and the surface grain runs lengthwise.
  geometry.rotateX(-Math.PI / 2);
  geometry.center();
  return toCreasedNormals(geometry, Math.PI / 6);
}

const beamBody = () => memo('beam', () => alongBeam(beamProfile(new THREE.Shape(), 0), L, 1));

const clampBand = () =>
  memo('band', () => {
    const shape = beamProfile(new THREE.Shape(), 2.6);
    shape.holes.push(beamProfile(new THREE.Path(), 0.6));
    return alongBeam(shape, 16, 0);
  });

// A label bent around a beam: a plane wrapped on a cylinder of radius r around the x axis, facing +z.
const wrapped = (w: number, h: number, r: number) =>
  memo(`wrapped ${w} ${h} ${r}`, () => {
    const geometry = new THREE.PlaneGeometry(w, h, 1, 16);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const angle = position.getY(i) / r;
      position.setXYZ(i, position.getX(i), r * Math.sin(angle), r * Math.cos(angle));
    }
    geometry.computeVertexNormals();
    return geometry;
  });

const handle = () =>
  memo('handle', () => {
    const s = new THREE.Shape();
    s.moveTo(-4.5, 0);
    s.lineTo(4.5, 0);
    s.lineTo(4.5, 5);
    s.lineTo(15.5, 5);
    s.quadraticCurveTo(17.5, 5, 17.5, 7);
    s.lineTo(17.5, 14);
    s.lineTo(11, 14);
    s.lineTo(10, 9.5);
    s.lineTo(-10, 9.5);
    s.lineTo(-11, 14);
    s.lineTo(-17.5, 14);
    s.lineTo(-17.5, 7);
    s.quadraticCurveTo(-17.5, 5, -15.5, 5);
    s.lineTo(-4.5, 5);
    s.closePath();
    const geometry = new THREE.ExtrudeGeometry(s, {
      depth: 8,
      bevelEnabled: true,
      bevelThickness: 0.8,
      bevelSize: 0.6,
      bevelSegments: 2,
      curveSegments: 6,
    });
    geometry.translate(0, 0, -4);
    return geometry;
  });

export function buildBrass(): ManifoldModel {
  const { add, paint, label, sticker, slot, finish } = assemble();

  const beam = (part: PartId, y: number, text: string, color: string) => {
    const m = paint(part);
    const g = new THREE.Group();
    g.position.set(0, y, depth(y));
    placeX(g, beamBody(), m('brass'), 0);
    const bore = place(g, memo('bore', () => new THREE.CircleGeometry(13, 40)), m('bore'), -END - 0.05);
    bore.rotation.y = -Math.PI / 2;
    const ring = place(g, memo('o-ring', () => new THREE.TorusGeometry(FLAT_Y - 3.5, 1.4, 12, 48)), m('black'), END + 0.4);
    ring.rotation.y = Math.PI / 2;
    for (const x of OUTLETS) {
      for (const side of [1, -1]) {
        place(g, cylinder(10.5, 4, 32), m('brass'), x, side * (FLAT_Y - 1));
        place(g, cylinder(7, 0.4, 32), m('bore'), x, side * (FLAT_Y + 1.05));
      }
    }
    place(g, wrapped(26, 10, R + 0.3), label(part, text, color), -END + 24);
    return add(part, g, new THREE.Vector3(0, y > 0 ? SPREAD : -SPREAD, 0));
  };

  const supply = beam('zasilanie', SUPPLY_Y, 'ZASILANIE', '#c8201c');
  const ret = beam('powrot', RETURN_Y, 'POWRÓT', '#1f3fa6');

  // The sticker sits where the real product carries the Huber label.
  const brandGroup = new THREE.Group();
  brandGroup.position.set(0, SUPPLY_Y, SUPPLY_Z);
  place(brandGroup, wrapped(45, 15, R + 0.4), sticker, 0);
  add('oznaczenie', brandGroup, STICKER_AWAY, { grow: STICKER_GROW, spin: STICKER_SPIN });
  place(supply, wrapped(45, 15, R + 0.2), slot, 0).userData.part = 'oznaczenie';

  const flowmeters = OUTLETS.map((x) => {
    const m = paint('rotametry');
    const g = new THREE.Group();
    g.position.set(x, SUPPLY_Y + FLAT_Y - 3, SUPPLY_Z);
    const top = stack(g, 0, 1, [
      [prism(11, 11, 4, 6), m('brass'), 4],
      [cylinder(14, 3), m('black'), 3],
      [prism(12.5, 13.5, 14, 12), m('black'), 14],
      [cylinder(10, 4), m('black'), 4],
      [cylinder(8, 3), m('red'), 3],
    ]);
    place(g, cylinder(4.6, 24, 32), m('glass'), 0, top + 12);
    place(g, cylinder(1.4, 24, 16), m('chrome'), 0, top + 12);
    place(g, cylinder(3.6, 2.5, 24), m('red'), 0, top + 8);
    place(g, handle(), m('red'), 0, top + 24);
    return add('rotametry', g, new THREE.Vector3(0, SPREAD + GAP, 0));
  });

  const caps = OUTLETS.map((x) => {
    const m = paint('wkladki');
    const g = new THREE.Group();
    g.position.set(x, RETURN_Y + FLAT_Y - 3, RETURN_Z);
    stack(g, 0, 1, [
      [prism(11.5, 11.5, 4, 6), m('chrome'), 4],
      [cylinder(13, 2), m('chrome'), 2],
      [prism(16.5, 16.5, 18, 8), m('blue'), 18],
      [prism(11, 16.5, 6, 8), m('blue'), 6],
    ]);
    g.rotation.y = Math.PI / 8;
    return add('wkladki', g, new THREE.Vector3(0, -SPREAD + GAP, 0));
  });

  const nipples = [SUPPLY_Y, RETURN_Y].flatMap((y) =>
    OUTLETS.map((x) => {
      const m = paint('przylacza');
      const g = new THREE.Group();
      g.position.set(x, y - FLAT_Y + 3, depth(y));
      const end = stack(g, 0, -1, [
        [prism(13, 13, 6, 6), m('brass'), 6],
        [ridged(12, 13, 1.6, 1), m('brass'), 13],
      ]);
      place(g, cylinder(8.5, 0.4, 32), m('bore'), 0, end - 0.1);
      return add('przylacza', g, new THREE.Vector3(0, (y > 0 ? SPREAD : -SPREAD) - GAP, 0), { zone: `przylacza ${y}` });
    }),
  );

  const brackets = BRACKETS.map((x) => {
    const m = paint('uchwyty');
    const g = new THREE.Group();
    g.position.x = x;
    const top = SUPPLY_Z - BAR_OFFSET;
    const bottom = RETURN_Z - BAR_OFFSET;
    const shape = () =>
      bentBar(
        [
          [SUPPLY_Y + R + 16, top],
          ...sBend([SUPPLY_Y - R - 16, top], [SUPPLY_Y - R - 34, WALL_Z]),
          ...sBend([RETURN_Y + R + 50, WALL_Z], [RETURN_Y + R + 20, bottom]),
          [RETURN_Y - R - 16, bottom],
        ],
        16,
        2.4,
      );
    place(g, memo('bar', shape), m('zinc'));
    for (const y of [SUPPLY_Y, RETURN_Y]) {
      const bar = depth(y) - BAR_OFFSET;
      placeX(g, clampBand(), m('zinc'), 0).position.set(0, y, depth(y));
      for (const dy of [R + 8, -R - 8]) {
        const screw = place(g, cylinder(4.2, 2, 24), m('brass'), 0, y + dy, bar + 2);
        screw.rotation.x = Math.PI / 2;
        for (const turn of [Math.PI / 4, -Math.PI / 4]) {
          const slot = place(g, memo('slot', () => new THREE.BoxGeometry(5.4, 0.9, 0.6)), m('black'), 0, y + dy, bar + 3.1);
          slot.rotation.z = turn;
        }
      }
    }
    for (const y of [42, -42]) {
      const hole = place(g, cylinder(3.6, 0.4, 24), m('black'), 0, y, WALL_Z + 1.3);
      hole.rotation.x = Math.PI / 2;
    }
    return add('uchwyty', g, new THREE.Vector3(0, 0, -BRACKET_BACK), { zone: `uchwyty ${x}` });
  });

  const tees = [SUPPLY_Y, RETURN_Y].map((y) => {
    const shift = y > 0 ? SPREAD : -SPREAD;

    const m = paint('trojnik');
    const tee = new THREE.Group();
    tee.position.set(TEE_X, y, depth(y));
    placeX(tee, cylinder(17.5, 12), m('brass'), END + 6 - TEE_X);
    placeX(tee, cylinder(10, 12), m('brass'), END + 17 - TEE_X);
    placeX(tee, prism(12.5, 12.5, 7, 6), m('brass'), END + 19 - TEE_X);
    place(tee, cylinder(13, 44), m('brass'));
    stack(tee, 22, 1, [
      [prism(15, 15, 6, 6), m('brass'), 6],
      [cylinder(9.5, 9), m('brass'), 9],
    ]);
    stack(tee, -22, -1, [[prism(15, 15, 9, 6), m('brass'), 9]]);
    add('trojnik', tee, new THREE.Vector3(TEE_OUT, shift, 0), { zone: `trojnik ${y}` });

    const v = paint('odpowietrznik');
    const vent = new THREE.Group();
    vent.position.set(TEE_X, y + 37, depth(y));
    stack(vent, 0, -1, [[ridged(8, 6, 1.4, 0.8), v('brass'), 6]]);
    stack(vent, 0, 1, [
      [ridged(15.5, 10, 1.2, 0.5), v('brass'), 10],
      [cylinder(13.5, 24), v('brass'), 24],
      [ridged(17, 8, 1.2, 0.5), v('brass'), 8],
      [cylinder(3.6, 9, 24), v('black'), 9],
    ]);
    add('odpowietrznik', vent, new THREE.Vector3(TEE_OUT, shift + GAP, 0), { zone: `odpowietrznik ${y}` });

    const drain = new THREE.Group();
    drain.position.set(TEE_X, y - 31, depth(y));
    stack(drain, 0, 1, [[ridged(8, 6, 1.4, 0.8), m('brass'), 6]]);
    stack(drain, 0, -1, [[cylinder(12.5, 16), m('black'), 16]]);
    const angle = -0.6;
    const dir = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
    const pivot = new THREE.Vector3(0, -9, 0);
    for (const [geometry, material, at] of [
      [cylinder(8, 18), m('black'), 14],
      [ridged(11, 6, 1.2, 0.5), m('brass'), 25],
    ] as const) {
      const mesh = place(drain, geometry, material);
      mesh.position.copy(pivot).addScaledVector(dir, at);
      mesh.rotation.z = angle - Math.PI / 2;
    }
    place(drain, cylinder(2.4, 8, 16), m('brass'), -2, -20);
    add('trojnik', drain, new THREE.Vector3(TEE_OUT, shift - GAP, 0), { zone: `trojnik ${y}` });

    return { tee, vent, drain };
  });

  const anchors: Record<PartId, Anchor> = {
    rotametry: { object: flowmeters[0], point: new THREE.Vector3(-17.5, 56, 0) },
    odpowietrznik: { object: tees[0].vent, point: new THREE.Vector3(17, 28, 0) },
    zasilanie: { object: supply, point: new THREE.Vector3(-END, 0, 8) },
    oznaczenie: { object: brandGroup, point: new THREE.Vector3(27, 0, R + 0.4) },
    uchwyty: { object: brackets[0], point: new THREE.Vector3(-8, -10, WALL_Z + 1.2) },
    wkladki: { object: caps[0], point: new THREE.Vector3(-16.5, 12, 0) },
    powrot: { object: ret, point: new THREE.Vector3(-END, 0, 8) },
    trojnik: { object: tees[1].tee, point: new THREE.Vector3(13, 0, 0) },
    przylacza: { object: nipples[OUTLETS.length], point: new THREE.Vector3(-12, -14, 0) },
  };

  const edge = new THREE.Vector3(0, R * Math.sin(7.5 / R), R * Math.cos(7.5 / R));
  const trail: [Anchor, Anchor] = [
    { object: supply, point: edge.clone().setY(-edge.y) },
    { object: brandGroup, point: edge.clone() },
  ];

  return finish(anchors, trail);
}
