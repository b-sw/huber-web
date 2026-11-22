// A five-circuit RW-PT manifold built from primitives, measured from the product photo.
// Units are millimetres. x runs along the beams, y points up, z points at the viewer.
import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PartId } from '../../data/manifold';
import { surfaced, type Surface } from './manifold-shading';

export interface Piece {
  object: THREE.Object3D;
  part: PartId;
  home: THREE.Vector3;
  rest: THREE.Euler;
  offset: THREE.Vector3;
  grow: number;
  spin: number;
  // Pieces in one zone share one hover area on screen, so the gaps between them also react.
  zone: string;
  phase: number;
}

export interface Anchor {
  object: THREE.Object3D;
  point: THREE.Vector3;
}

export interface ManifoldModel {
  root: THREE.Group;
  pieces: Piece[];
  anchors: Record<PartId, Anchor>;
  // From the sticker's place on the beam to the floating sticker.
  trail: [Anchor, Anchor];
  highlight(part: PartId | null): void;
  setBrand(text: string): void;
  // Settles when the stickers are painted with the page fonts.
  ready: Promise<void>;
}

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

type Finish = 'brass' | 'zinc' | 'chrome' | 'black' | 'red' | 'blue' | 'glass' | 'bore';

const FINISHES: Record<Finish, [THREE.MeshPhysicalMaterialParameters, Surface]> = {
  brass: [
    { color: 0xe8b85e, metalness: 1, roughness: 0.2 },
    { size: 7, stretch: 6, rough: 0.07, tone: 0.07, bump: 0.05 },
  ],
  zinc: [
    { color: 0xd2cdc2, metalness: 1, roughness: 0.26, side: THREE.DoubleSide },
    { size: 2.5, stretch: 12, rough: 0.1, tone: 0.03, bump: 0.01 },
  ],
  chrome: [{ color: 0xeeeeee, metalness: 1, roughness: 0.08 }, { size: 6, stretch: 4, rough: 0.03, tone: 0, bump: 0 }],
  black: [
    { color: 0x1b1c20, metalness: 0, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.25 },
    { size: 2.5, stretch: 1, rough: 0.12, tone: 0.1, bump: 0.01 },
  ],
  red: [
    { color: 0xd8241a, metalness: 0, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.12 },
    { size: 5, stretch: 1, rough: 0.06, tone: 0.04, bump: 0.01 },
  ],
  blue: [
    { color: 0x1c46c2, metalness: 0, roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.22 },
    { size: 5, stretch: 1, rough: 0.08, tone: 0.04, bump: 0.01 },
  ],
  glass: [
    { color: 0xdfe9ee, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.22, depthWrite: false },
    { size: 4, stretch: 4, rough: 0, tone: 0, bump: 0, rim: 3.2 },
  ],
  bore: [{ color: 0x3a2a12, metalness: 1, roughness: 0.55 }, { size: 3, stretch: 1, rough: 0.15, tone: 0.2, bump: 0 }],
};

const geometries = new Map<string, THREE.BufferGeometry>();

function memo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let geometry = geometries.get(key);
  if (!geometry) {
    geometry = make();
    geometries.set(key, geometry);
  }
  return geometry;
}

function indexed(position: number[], normal: number[], index: number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geometry.setIndex(index);
  return geometry;
}

// Each profile step keeps its own normals, so a chamfer shades as a separate band.
function turned(profile: [radius: number, y: number][], sides: number, faceted: boolean) {
  const columns: [angle: number, facing: number][] = [];
  const quads: number[] = [];
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2;
    const b = ((k + 1) / sides) * Math.PI * 2;
    if (faceted) {
      quads.push(columns.length);
      columns.push([a, (a + b) / 2], [b, (a + b) / 2]);
    } else {
      quads.push(k);
      columns.push([a, a]);
      if (k === sides - 1) columns.push([b, b]);
    }
  }
  const apothem = faceted ? Math.cos(Math.PI / sides) : 1;
  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, y0] = profile[i];
    const [r1, y1] = profile[i + 1];
    const length = Math.hypot((r1 - r0) * apothem, y1 - y0);
    if (length === 0) continue;
    const nr = (y1 - y0) / length;
    const ny = ((r0 - r1) * apothem) / length;
    const base = position.length / 3;
    for (const [angle, facing] of columns) {
      for (const [r, y] of [profile[i], profile[i + 1]]) {
        position.push(r * Math.sin(angle), y, r * Math.cos(angle));
        normal.push(nr * Math.sin(facing), ny, nr * Math.cos(facing));
      }
    }
    for (const k of quads) {
      const a = base + k * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  return indexed(position, normal, index);
}

// Machined edges are never sharp. The chamfer catches a thin line of light. Thin disks are flat marks and stay sharp.
const chamfered = (rTop: number, rBottom: number, h: number): [radius: number, y: number][] => {
  const c = h < 2 ? 0 : Math.min(1, h / 6, Math.min(rTop, rBottom) / 8);
  const at = (y: number) => rBottom + ((rTop - rBottom) * (y + h / 2)) / h;
  return [
    [0, -h / 2],
    [rBottom - c, -h / 2],
    [at(-h / 2 + c), -h / 2 + c],
    [at(h / 2 - c), h / 2 - c],
    [rTop - c, h / 2],
    [0, h / 2],
  ];
};

const cylinder = (r: number, h: number, segments = 48) =>
  memo(`cyl ${r} ${h} ${segments}`, () => turned(chamfered(r, r, h), segments, false));

// A flat-faced prism: hex nuts, octagonal caps, ribbed plastic.
const prism = (rTop: number, rBottom: number, h: number, sides: number) =>
  memo(`prism ${rTop} ${rBottom} ${h} ${sides}`, () => turned(chamfered(rTop, rBottom, h), sides, true));

function bentBar(path: [y: number, z: number][], width: number, thickness: number) {
  const w = width / 2;
  const t = thickness / 2;
  const chamfer = t / 2;
  // Counterclockwise in the plane of x and the bar's front normal.
  const section: [x: number, n: number][] = [
    [w, -t + chamfer],
    [w, t - chamfer],
    [w - chamfer, t],
    [-w + chamfer, t],
    [-w, t - chamfer],
    [-w, -t + chamfer],
    [-w + chamfer, -t],
    [w - chamfer, -t],
  ];
  const frames = path.map(([y, z], i) => {
    const [y0, z0] = path[Math.max(i - 1, 0)];
    const [y1, z1] = path[Math.min(i + 1, path.length - 1)];
    const length = Math.hypot(y1 - y0, z1 - z0);
    const ty = (y1 - y0) / length;
    const tz = (z1 - z0) / length;
    return { y, z, ty, tz, ny: tz, nz: -ty };
  });
  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];
  const put = (f: (typeof frames)[number], x: number, n: number) => position.push(x, f.y + n * f.ny, f.z + n * f.nz);
  section.forEach(([x0, n0], j) => {
    const [x1, n1] = section[(j + 1) % section.length];
    const length = Math.hypot(x1 - x0, n1 - n0);
    const mx = (n1 - n0) / length;
    const mn = (x0 - x1) / length;
    const base = position.length / 3;
    for (const f of frames) {
      put(f, x0, n0);
      put(f, x1, n1);
      normal.push(mx, mn * f.ny, mn * f.nz, mx, mn * f.ny, mn * f.nz);
    }
    for (let i = 0; i < frames.length - 1; i++) {
      const a = base + i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  for (const [f, sign] of [
    [frames[0], -1],
    [frames[frames.length - 1], 1],
  ] as const) {
    const base = position.length / 3;
    for (const [x, n] of section) {
      put(f, x, n);
      normal.push(0, sign * f.ty, sign * f.tz);
    }
    for (let j = 1; j < section.length - 1; j++) {
      index.push(base, base + (sign > 0 ? j : j + 1), base + (sign > 0 ? j + 1 : j));
    }
  }
  return indexed(position, normal, index);
}

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

const sBend = ([y0, z0]: [y: number, z: number], [y1, z1]: [y: number, z: number], steps = 16): [y: number, z: number][] =>
  Array.from({ length: steps + 1 }, (_, k) => {
    const t = k / steps;
    return [y0 + (y1 - y0) * t, z0 + ((z1 - z0) * (1 - Math.cos(Math.PI * t))) / 2];
  });

const ridged = (r: number, h: number, pitch: number, depth: number) =>
  memo(`ridged ${r} ${h} ${pitch} ${depth}`, () => {
    const points = [new THREE.Vector2(0, 0), new THREE.Vector2(r - depth, 0)];
    for (let y = pitch / 2, k = 1; y < h; y += pitch / 2, k++) {
      points.push(new THREE.Vector2(k % 2 ? r : r - depth, y));
    }
    points.push(new THREE.Vector2(r - depth, h), new THREE.Vector2(0, h));
    const geometry = new THREE.LatheGeometry(points, 48);
    geometry.translate(0, -h / 2, 0);
    return geometry;
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

type Layer = [THREE.BufferGeometry, THREE.Material, number];

function stack(group: THREE.Object3D, from: number, dir: 1 | -1, layers: Layer[]): number {
  let y = from;
  for (const [geometry, material, h] of layers) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = y + (dir * h) / 2;
    group.add(mesh);
    y += dir * h;
  }
  return y;
}

function place(group: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function placeX(group: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x: number) {
  const mesh = place(group, geometry, material, x);
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

function stickerTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const paint = () => {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    draw(ctx);
    texture.needsUpdate = true;
  };
  paint();
  return { texture, paint };
}

function roundRect(ctx: CanvasRenderingContext2D, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fill();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, max: number, maxWidth: number) {
  let size = max;
  ctx.font = font(size);
  const width = ctx.measureText(text).width;
  if (width > maxWidth) {
    size = Math.floor((size * maxWidth) / width);
    ctx.font = font(size);
  }
  return size;
}

export function buildManifold(): ManifoldModel {
  const root = new THREE.Group();
  const pieces: Piece[] = [];
  const materials = new Map<PartId, THREE.MeshStandardMaterial[]>();

  const repaints: (() => void)[] = [];

  // Each part owns its materials, so one part can stay solid while the others fade.
  const track = (part: PartId, material: THREE.MeshStandardMaterial) => {
    const { opacity, transparent, depthWrite } = material;
    material.userData.base = { opacity, transparent, depthWrite };
    const list = materials.get(part) ?? [];
    list.push(material);
    materials.set(part, list);
  };
  const finishes = new Map<PartId, Map<Finish, THREE.MeshStandardMaterial>>();
  const paint = (part: PartId) => (finish: Finish) => {
    let byFinish = finishes.get(part);
    if (!byFinish) finishes.set(part, (byFinish = new Map()));
    let material = byFinish.get(finish);
    if (!material) {
      const [params, surface] = FINISHES[finish];
      material = surfaced(new THREE.MeshPhysicalMaterial(params), surface);
      byFinish.set(finish, material);
      track(part, material);
    }
    return material;
  };

  const add = (
    part: PartId,
    object: THREE.Object3D,
    offset: THREE.Vector3,
    { zone = part as string, grow = 1, spin = 0 } = {},
  ) => {
    object.traverse((child) => (child.userData.part = part));
    root.add(object);
    const home = object.position.clone();
    const rest = object.rotation.clone();
    pieces.push({ object, part, home, rest, offset, grow, spin, zone, phase: pieces.length * 1.7 });
    return object;
  };

  const font = (weight: number, family: string, stretch = '') => (size: number) =>
    `${weight} ${stretch} ${size}px ${family}`;

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

    const { texture, paint: repaint } = stickerTexture(520, 200, (ctx) => {
      roundRect(ctx, 520, 200, 26, color);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(ctx, text, font(700, '"Archivo Subset", Arial, sans-serif', 'condensed'), 112, 440);
      ctx.fillText(text, 260, 106);
    });
    repaints.push(repaint);
    const label = new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.5 });
    track(part, label);
    place(g, wrapped(26, 10, R + 0.3), label, -END + 24);
    return add(part, g, new THREE.Vector3(0, y > 0 ? SPREAD : -SPREAD, 0));
  };

  const supply = beam('zasilanie', SUPPLY_Y, 'ZASILANIE', '#c8201c');
  const ret = beam('powrot', RETURN_Y, 'POWRÓT', '#1f3fa6');

  // The sticker sits where the real product carries the Huber label.
  let brand = 'TWOJA MARKA';
  const sticker = stickerTexture(768, 256, (ctx) => {
    roundRect(ctx, 768, 256, 18, '#f7f6f2');
    ctx.strokeStyle = 'rgba(60, 40, 20, 0.4)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(4, 4, 760, 248, 16);
    ctx.stroke();
    ctx.fillStyle = '#161412';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(ctx, brand, font(800, '"Archivo Subset", "Arial Narrow", sans-serif', 'condensed'), 132, 620);
    ctx.fillText(brand, 384, 136);
  });
  repaints.push(sticker.paint);
  const stickerMaterial = new THREE.MeshStandardMaterial({ map: sticker.texture, transparent: true, roughness: 0.55 });
  track('oznaczenie', stickerMaterial);
  const brandGroup = new THREE.Group();
  brandGroup.position.set(0, SUPPLY_Y, SUPPLY_Z);
  place(brandGroup, wrapped(45, 15, R + 0.4), stickerMaterial, 0);
  add('oznaczenie', brandGroup, STICKER_AWAY, { grow: STICKER_GROW, spin: STICKER_SPIN });

  // A dashed outline marks the sticker's place on the beam while the sticker is away.
  // Light dashes with a dark edge read on both the bright and the dark bands of the brass.
  const slot = stickerTexture(768, 256, (ctx) => {
    ctx.setLineDash([30, 18]);
    ctx.beginPath();
    ctx.roundRect(12, 12, 744, 232, 18);
    for (const [color, width] of [['#3b230f', 22], ['#f4e7d0', 10]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  });
  const slotMaterial = new THREE.MeshStandardMaterial({ map: slot.texture, transparent: true, roughness: 0.6 });
  track('oznaczenie', slotMaterial);
  place(supply, wrapped(45, 15, R + 0.2), slotMaterial, 0).userData.part = 'oznaczenie';

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

  const ready = Promise.all([
    document.fonts.load('800 condensed 100px "Archivo Subset"'),
    document.fonts.load('700 condensed 100px "Archivo Subset"'),
  ]).then(() => repaints.forEach((repaint) => repaint()));

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

  return {
    root,
    pieces,
    anchors,
    trail,
    ready,
    highlight(part) {
      for (const [owner, list] of materials) {
        for (const material of list) {
          const base = material.userData.base as Pick<THREE.Material, 'opacity' | 'transparent' | 'depthWrite'>;
          const dim = part !== null && owner !== part;
          const transparent = dim || base.transparent;
          material.opacity = dim ? base.opacity * 0.14 : base.opacity;
          material.depthWrite = dim ? false : base.depthWrite;
          if (material.transparent !== transparent) {
            material.transparent = transparent;
            material.needsUpdate = true;
          }
        }
      }
    },
    setBrand(text) {
      brand = text;
      sticker.paint();
    },
  };
}
