// A five-circuit RW-PT manifold built from primitives, measured from the product photo and photos of its parts.
// Units are millimetres. x runs along the beams, y points up, z points at the viewer.
import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
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
  turned,
  type Anchor,
  type ManifoldModel,
} from './manifold-kit';
import { flowMeter, meterScaleMaterial, nipple, oRing, thermostaticInsert, type NippleShape } from './manifold-parts';

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
// The parts on the outlets seat on the outlet bosses.
const SEAT = FLAT_Y + 1;
const BRACKETS = [-75, 75];
const TEE_X = END + 28;
const TEE_HALF = 24;
// The tee arm screws into the beam end, so both have one bore.
const BORE = 13.5;
const bore = () => memo('bore', () => new THREE.CircleGeometry(BORE, 40));
// The drain outlet points out to the right and at the viewer, a little down.
const DRAIN_TURN = 0.7;
const DRAIN_TILT = 0.25;

const SPREAD = 24;
const GAP = 30;
// A part with a long stem lifts further, until the stem clears the beam by this much.
const CLEAR = 16;
const NIPPLE: NippleShape = { hex: [14, 5.6], neck: [11.6, 4.5], thread: [13.2, 8.5] };
const TEE_OUT = 46;
const BRACKET_BACK = 70;
// The sticker leaves the beam and floats in the open space between the beams, bigger and turned to the viewer.
const STICKER_AWAY = new THREE.Vector3(0, -96, 50);
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

const teeBody = () =>
  memo('tee body', () =>
    turned(
      [
        [0, -TEE_HALF],
        [9.8, -TEE_HALF],
        [10.8, -TEE_HALF + 1],
        [10.8, -14],
        [10, -12],
        [10, 12],
        [10.8, 14],
        [10.8, TEE_HALF - 1],
        [9.8, TEE_HALF],
        [0, TEE_HALF],
      ],
      48,
      false,
    ),
  );

const drainBody = () =>
  memo('drain body', () =>
    turned(
      [
        [0, -6.5],
        [5, -6.5],
        [7.2, -5.9],
        [8.4, -4.4],
        [8.8, -2.5],
        [9.9, 6.5],
        [0, 6.5],
      ],
      40,
      false,
    ),
  );

const drainNeck = () =>
  memo('drain neck', () =>
    turned(
      [
        [0, -5.5],
        [6.5, -5.5],
        [8.8, 5.5],
        [0, 5.5],
      ],
      32,
      false,
    ),
  );

// A flat strap beside the body and the outlet. It runs from the collar past the far end and loops back to the cap.
const drainStrap = () =>
  memo('drain strap', () => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    path.add(new THREE.LineCurve3(new THREE.Vector3(0, 6, 0.4), new THREE.Vector3(0, -9, 0.4)));
    path.add(
      new THREE.CubicBezierCurve3(
        new THREE.Vector3(0, -9, 0.4),
        new THREE.Vector3(0, -21, 1),
        new THREE.Vector3(0, -22, 17),
        new THREE.Vector3(0, -12.6, 21),
      ),
    );
    return new THREE.TubeGeometry(path, 48, 2.2, 8, false).scale(0.25, 1, 1);
  });

export function buildBrass(): ManifoldModel {
  const { add, paint, track, label, sticker, slot, finish } = assemble();

  const beam = (part: PartId, y: number, text: string, color: string) => {
    const m = paint(part);
    const g = new THREE.Group();
    g.position.set(0, y, depth(y));
    placeX(g, beamBody(), m('brass'), 0);
    for (const side of [-1, 1]) {
      place(g, bore(), m('bore'), side * (END + 0.05)).rotation.y = (side * Math.PI) / 2;
    }
    for (const x of OUTLETS) {
      for (const side of [1, -1]) {
        place(g, cylinder(12, 4, 32), m('brass'), x, side * (FLAT_Y - 1));
        place(g, cylinder(9.3, 0.4, 32), m('bore'), x, side * (FLAT_Y + 1.05));
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
      const group = nipple(paint('przylacza'), 'brass', NIPPLE);
      group.position.set(x, y - SEAT, depth(y));
      return add('przylacza', group, new THREE.Vector3(0, (y > 0 ? SPREAD : -SPREAD) - GAP, 0), { zone: `przylacza ${y}` });
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

    // The O-ring seals against the beam end face.
    const m = paint('trojnik');
    const tee = new THREE.Group();
    tee.position.set(TEE_X, y, depth(y));
    place(tee, teeBody(), m('cast'));
    for (const side of [1, -1]) place(tee, cylinder(7.4, 0.4, 32), m('bore'), 0, side * (TEE_HALF + 0.05));
    placeX(tee, prism(11, 11, 10, 6), m('cast'), END + 16.8 - TEE_X);
    placeX(tee, prism(19, 19, 8, 6), m('brass'), END + 7.8 - TEE_X);
    placeX(tee, ridged(16.6, 12, 2.3, 1.4), m('brass'), END - 2.2 - TEE_X);
    const ring = place(tee, memo('tee o-ring', () => new THREE.TorusGeometry(16, 1.9, 12, 48)), m('black'), END + 1.9 - TEE_X);
    ring.rotation.y = Math.PI / 2;
    place(tee, bore(), m('bore'), END - 8.25 - TEE_X).rotation.y = -Math.PI / 2;
    add('trojnik', tee, new THREE.Vector3(TEE_OUT, shift, 0), { zone: `trojnik ${y}` });

    const v = paint('odpowietrznik');
    const vent = new THREE.Group();
    vent.position.set(TEE_X, y + TEE_HALF, depth(y));
    stack(vent, 0, -1, [
      [ridged(8.3, 8.5, 1.3, 0.6), v('brass'), 8.5],
      [cylinder(2.2, 2, 16), v('black'), 2],
      [cylinder(4.4, 2, 24), v('black'), 2],
    ]);
    place(vent, oRing(8.6, 0.9), v('black'), 0, -1);
    stack(vent, 0, 1, [
      [prism(10, 10, 13.8, 6), v('brass'), 13.8],
      [cylinder(11.5, 36), v('brass'), 36],
      [cylinder(12.8, 2), v('brass'), 2],
      [fluted(13.1, 0.35, 8.5, 90), v('brass'), 8.5],
      [cylinder(12.6, 1.5), v('brass'), 1.5],
      [prism(4.8, 5.8, 9, 18), v('black'), 9],
      [cylinder(4.2, 1.2, 24), v('black'), 1.2],
    ]);
    add('odpowietrznik', vent, new THREE.Vector3(TEE_OUT, shift + GAP, 0), { zone: `odpowietrznik ${y}` });

    const drain = new THREE.Group();
    drain.position.set(TEE_X, y - TEE_HALF, depth(y));
    stack(drain, 0, 1, [[ridged(8.3, 7, 1.3, 0.6), m('brass'), 7]]);
    place(drain, oRing(8.6, 0.9), m('black'), 0, 1);
    const body = stack(drain, 0, -1, [
      [prism(10.7, 10.7, 7, 6), m('brass'), 7],
      [cylinder(10.2, 3), m('black'), 3],
      [drainBody(), m('black'), 13],
      [prism(1.7, 1.7, 3.5, 6), m('brass'), 3.5],
    ]);
    const outlet = new THREE.Group();
    outlet.position.y = body + 11;
    outlet.rotation.y = DRAIN_TURN;
    drain.add(outlet);
    const dir = new THREE.Vector3(0, -Math.sin(DRAIN_TILT), Math.cos(DRAIN_TILT));
    for (const [geometry, at] of [
      [drainNeck(), 14.5],
      [fluted(12.7, 0.6, 8, 26), 23.5],
      [cylinder(3.7, 5.5, 24), 30.25],
    ] as const) {
      const mesh = place(outlet, geometry, m('black'));
      mesh.position.copy(dir).multiplyScalar(at);
      mesh.rotation.x = Math.PI / 2 + DRAIN_TILT;
    }
    place(outlet, drainStrap(), m('black'), -10.5);
    add('trojnik', drain, new THREE.Vector3(TEE_OUT, shift - GAP, 0), { zone: `trojnik ${y}` });

    return { tee, vent, drain };
  });

  const anchors: Record<PartId, Anchor> = {
    rotametry: { object: flowmeters[0], point: new THREE.Vector3(-14.3, 12, 0) },
    odpowietrznik: { object: tees[0].vent, point: new THREE.Vector3(11.5, 32, 0) },
    zasilanie: { object: supply, point: new THREE.Vector3(-END, 0, 8) },
    oznaczenie: { object: brandGroup, point: new THREE.Vector3(27, 0, R + 0.4) },
    uchwyty: { object: brackets[0], point: new THREE.Vector3(-8, -10, WALL_Z + 1.2) },
    wkladki: { object: caps[0], point: new THREE.Vector3(-16.5, 12, 0) },
    powrot: { object: ret, point: new THREE.Vector3(-END, 0, 8) },
    trojnik: { object: tees[1].tee, point: new THREE.Vector3(10, 0, 0) },
    przylacza: { object: nipples[OUTLETS.length], point: new THREE.Vector3(-13.2, -14.5, 0) },
  };

  const edge = new THREE.Vector3(0, R * Math.sin(7.5 / R), R * Math.cos(7.5 / R));
  const trail: [Anchor, Anchor] = [
    { object: supply, point: edge.clone().setY(-edge.y) },
    { object: brandGroup, point: edge.clone() },
  ];

  return finish(anchors, trail);
}
