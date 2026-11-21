// A five-circuit RW-PT manifold built from primitives, measured from the product photo.
// Units are millimetres. x runs along the beams, y points up, z points at the viewer.
import * as THREE from 'three';
import type { PartId } from '../../data/manifold';

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
const L = 260;
const END = L / 2;
const SUPPLY_Y = 120;
const RETURN_Y = -120;
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

const FINISHES: Record<Finish, THREE.MeshStandardMaterialParameters> = {
  brass: { color: 0xd9a646, metalness: 1, roughness: 0.3 },
  zinc: { color: 0xb4b2a6, metalness: 1, roughness: 0.28, side: THREE.DoubleSide },
  chrome: { color: 0xf0f0f0, metalness: 1, roughness: 0.12 },
  black: { color: 0x17191e, metalness: 0, roughness: 0.42 },
  red: { color: 0xd3271f, metalness: 0, roughness: 0.34 },
  blue: { color: 0x2350d6, metalness: 0, roughness: 0.38 },
  glass: { color: 0xcfdde6, metalness: 0, roughness: 0.08, transparent: true, opacity: 0.55, depthWrite: false },
  bore: { color: 0x3a2a12, metalness: 1, roughness: 0.6 },
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

const cylinder = (r: number, h: number, segments = 48) =>
  memo(`cyl ${r} ${h} ${segments}`, () => new THREE.CylinderGeometry(r, r, h, segments));

// A flat-faced prism: hex nuts, octagonal caps, ribbed plastic.
const prism = (rTop: number, rBottom: number, h: number, sides: number) =>
  memo(`prism ${rTop} ${rBottom} ${h} ${sides}`, () => {
    const geometry = new THREE.CylinderGeometry(rTop, rBottom, h, sides).toNonIndexed();
    geometry.computeVertexNormals();
    return geometry;
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
      material = new THREE.MeshStandardMaterial(FINISHES[finish]);
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
    g.position.y = y;
    placeX(g, cylinder(R, L, 64), m('brass'), 0);
    const bore = place(g, memo('bore', () => new THREE.CircleGeometry(13, 40)), m('bore'), -END - 0.05);
    bore.rotation.y = -Math.PI / 2;
    const ring = place(g, memo('o-ring', () => new THREE.TorusGeometry(R - 2.5, 1.4, 12, 48)), m('black'), END + 0.4);
    ring.rotation.y = Math.PI / 2;
    for (const x of OUTLETS) {
      for (const side of [1, -1]) {
        place(g, cylinder(10.5, 4, 32), m('brass'), x, side * (R - 1));
        place(g, cylinder(7, 0.4, 32), m('bore'), x, side * (R + 1.05));
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
  brandGroup.position.y = SUPPLY_Y;
  place(brandGroup, wrapped(45, 15, R + 0.4), stickerMaterial, 0);
  add('oznaczenie', brandGroup, STICKER_AWAY, { grow: STICKER_GROW, spin: STICKER_SPIN });

  // A dashed outline marks the sticker's place on the beam while the sticker is away.
  const slot = stickerTexture(768, 256, (ctx) => {
    ctx.strokeStyle = '#8a4f25';
    ctx.lineWidth = 14;
    ctx.setLineDash([30, 18]);
    ctx.beginPath();
    ctx.roundRect(8, 8, 752, 240, 18);
    ctx.stroke();
  });
  const slotMaterial = new THREE.MeshStandardMaterial({ map: slot.texture, transparent: true, roughness: 0.6 });
  track('oznaczenie', slotMaterial);
  place(supply, wrapped(45, 15, R + 0.2), slotMaterial, 0).userData.part = 'oznaczenie';

  const flowmeters = OUTLETS.map((x) => {
    const m = paint('rotametry');
    const g = new THREE.Group();
    g.position.set(x, SUPPLY_Y + R - 3, 0);
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
    g.position.set(x, RETURN_Y + R - 3, 0);
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
      g.position.set(x, y - R + 3, 0);
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
    const span = SUPPLY_Y - RETURN_Y + 2 * (R + 16);
    place(g, memo('strap', () => new THREE.BoxGeometry(16, span, 2)), m('zinc'), 0, 0, -R - 4);
    for (const y of [SUPPLY_Y, RETURN_Y]) {
      placeX(g, memo('band', () => new THREE.CylinderGeometry(R + 1.2, R + 1.2, 16, 48, 1, true)), m('zinc'), 0).position.y = y;
      for (const dy of [R + 8, -R - 8]) {
        const screw = place(g, cylinder(4.2, 2, 24), m('brass'), 0, y + dy, -R - 2);
        screw.rotation.x = Math.PI / 2;
        for (const turn of [Math.PI / 4, -Math.PI / 4]) {
          const slot = place(g, memo('slot', () => new THREE.BoxGeometry(5.4, 0.9, 0.6)), m('black'), 0, y + dy, -R - 0.9);
          slot.rotation.z = turn;
        }
      }
    }
    for (const y of [42, -42]) {
      const hole = place(g, cylinder(3.6, 0.4, 24), m('black'), 0, y, -R - 2.9);
      hole.rotation.x = Math.PI / 2;
    }
    return add('uchwyty', g, new THREE.Vector3(0, 0, -BRACKET_BACK), { zone: `uchwyty ${x}` });
  });

  const tees = [SUPPLY_Y, RETURN_Y].map((y) => {
    const shift = y > 0 ? SPREAD : -SPREAD;

    const m = paint('trojnik');
    const tee = new THREE.Group();
    tee.position.set(TEE_X, y, 0);
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
    vent.position.set(TEE_X, y + 37, 0);
    stack(vent, 0, -1, [[ridged(8, 6, 1.4, 0.8), v('brass'), 6]]);
    stack(vent, 0, 1, [
      [ridged(15.5, 10, 1.2, 0.5), v('brass'), 10],
      [cylinder(13.5, 24), v('brass'), 24],
      [ridged(17, 8, 1.2, 0.5), v('brass'), 8],
      [cylinder(3.6, 9, 24), v('black'), 9],
    ]);
    add('odpowietrznik', vent, new THREE.Vector3(TEE_OUT, shift + GAP, 0), { zone: `odpowietrznik ${y}` });

    const drain = new THREE.Group();
    drain.position.set(TEE_X, y - 31, 0);
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
    uchwyty: { object: brackets[0], point: new THREE.Vector3(-8, -10, -R - 3) },
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
