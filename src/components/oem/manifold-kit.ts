// What every exploded manifold shares.
// Units are millimetres. x runs along the beams, y points up, z points at the viewer.
import * as THREE from 'three';
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

export type Finish =
  | 'brass'
  | 'cast'
  | 'zinc'
  | 'chrome'
  | 'steel'
  | 'nickel'
  | 'black'
  | 'red'
  | 'blue'
  | 'navy'
  | 'glass'
  | 'bore'
  | 'socket';

const FINISHES: Record<Finish, [THREE.MeshPhysicalMaterialParameters, Surface]> = {
  brass: [
    { color: 0xe8b85e, metalness: 1, roughness: 0.2 },
    { size: 7, stretch: 6, rough: 0.07, tone: 0.07, bump: 0.05 },
  ],
  cast: [
    { color: 0xc99a57, metalness: 1, roughness: 0.52 },
    { size: 0.7, stretch: 1, rough: 0.16, tone: 0.1, bump: 0.03 },
  ],
  zinc: [
    { color: 0xd2cdc2, metalness: 1, roughness: 0.26, side: THREE.DoubleSide },
    { size: 2.5, stretch: 12, rough: 0.1, tone: 0.03, bump: 0.01 },
  ],
  chrome: [{ color: 0xeeeeee, metalness: 1, roughness: 0.08 }, { size: 6, stretch: 4, rough: 0.03, tone: 0, bump: 0 }],
  steel: [
    { color: 0xd5d3cd, metalness: 1, roughness: 0.28 },
    { size: 0.9, stretch: 40, rough: 0.07, tone: 0.02, bump: 0.003 },
  ],
  // Satin, not a mirror like chrome.
  nickel: [
    { color: 0xd9d3c8, metalness: 1, roughness: 0.22 },
    { size: 3, stretch: 3, rough: 0.06, tone: 0.03, bump: 0.01 },
  ],
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
  // Matte, with a fine grain like the real insert caps.
  navy: [
    { color: 0x0f1c66, metalness: 0, roughness: 0.62, clearcoat: 0.1, clearcoatRoughness: 0.5 },
    { size: 0.5, stretch: 1, rough: 0.06, tone: 0.015, bump: 0.006 },
  ],
  glass: [
    { color: 0xdfe9ee, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.22, depthWrite: false },
    { size: 4, stretch: 4, rough: 0, tone: 0, bump: 0, rim: 3.2 },
  ],
  bore: [{ color: 0x3a2a12, metalness: 1, roughness: 0.55 }, { size: 3, stretch: 1, rough: 0.15, tone: 0.2, bump: 0 }],
  socket: [
    { color: 0x2c2c2e, metalness: 1, roughness: 0.55 },
    { size: 3, stretch: 1, rough: 0.15, tone: 0.2, bump: 0 },
  ],
};

const geometries = new Map<string, THREE.BufferGeometry>();

export function memo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
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
// The profile runs from the bottom centre out, up the side and back in to the top centre.
export function turned(profile: [radius: number, y: number][], sides: number, faceted: boolean) {
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

export const cylinder = (r: number, h: number, segments = 48) =>
  memo(`cyl ${r} ${h} ${segments}`, () => turned(chamfered(r, r, h), segments, false));

// A flat-faced prism: hex nuts, octagonal caps, ribbed plastic.
export const prism = (rTop: number, rBottom: number, h: number, sides: number) =>
  memo(`prism ${rTop} ${rBottom} ${h} ${sides}`, () => turned(chamfered(rTop, rBottom, h), sides, true));

export function bentBar(path: [y: number, z: number][], width: number, thickness: number) {
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

export const sBend = (
  [y0, z0]: [y: number, z: number],
  [y1, z1]: [y: number, z: number],
  steps = 16,
): [y: number, z: number][] =>
  Array.from({ length: steps + 1 }, (_, k) => {
    const t = k / steps;
    return [y0 + (y1 - y0) * t, z0 + ((z1 - z0) * (1 - Math.cos(Math.PI * t))) / 2];
  });

export const ridged = (r: number, h: number, pitch: number, depth: number) =>
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

// Knurled and ribbed rings: a star-shaped section stood along y. Flat faces keep each rib sharp.
export const fluted = (r: number, cut: number, h: number, count: number) =>
  memo(`fluted ${r} ${cut} ${h} ${count}`, () => {
    const shape = new THREE.Shape();
    for (let k = 0; k < count * 2; k++) {
      const a = (k / (count * 2)) * Math.PI * 2;
      const radius = k % 2 ? r - cut : r;
      if (k) shape.lineTo(radius * Math.cos(a), radius * Math.sin(a));
      else shape.moveTo(radius, 0);
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -h / 2, 0);
    return geometry;
  });

export type Layer = [THREE.BufferGeometry, THREE.Material, number];

export function stack(group: THREE.Object3D, from: number, dir: 1 | -1, layers: Layer[]): number {
  let y = from;
  for (const [geometry, material, h] of layers) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = y + (dir * h) / 2;
    group.add(mesh);
    y += dir * h;
  }
  return y;
}

export function place(group: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

export function placeX(group: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x: number) {
  const mesh = place(group, geometry, material, x);
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

export function stickerTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
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

const font = (weight: number, family: string, stretch = '') => (size: number) =>
  `${weight} ${stretch} ${size}px ${family}`;

// Builders take every material from paint, track or label, so highlight() can fade it.
export function assemble() {
  const root = new THREE.Group();
  const pieces: Piece[] = [];
  const materials = new Map<PartId, THREE.MeshStandardMaterial[]>();
  const repaints: (() => void)[] = [];

  // Each part owns its materials, so one part can stay solid while the others fade.
  const track = <T extends THREE.MeshStandardMaterial>(part: PartId, material: T) => {
    const { opacity, transparent, depthWrite } = material;
    material.userData.base = { opacity, transparent, depthWrite };
    const list = materials.get(part) ?? [];
    list.push(material);
    materials.set(part, list);
    return material;
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

  // Paints again once the page fonts load.
  const printed = (width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const sticker = stickerTexture(width, height, draw);
    repaints.push(sticker.paint);
    return sticker;
  };

  const label = (part: PartId, text: string, color: string, width = 520) => {
    const { texture } = printed(width, 200, (ctx) => {
      roundRect(ctx, width, 200, 26, color);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(ctx, text, font(700, '"Archivo Subset", Arial, sans-serif', 'condensed'), 112, width - 80);
      ctx.fillText(text, width / 2, 106);
    });
    return track(part, new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.5 }));
  };

  let brand = 'TWOJA MARKA';
  const sticker = printed(768, 256, (ctx) => {
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
  const stickerMaterial = new THREE.MeshStandardMaterial({ map: sticker.texture, transparent: true, roughness: 0.55 });
  track('oznaczenie', stickerMaterial);

  // A dashed outline marks the sticker's place on the beam while the sticker is away.
  // Light dashes with a dark edge read on both the bright and the dark bands of the metal.
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

  const finish = (anchors: Record<PartId, Anchor>, trail: [Anchor, Anchor]): ManifoldModel => ({
    root,
    pieces,
    anchors,
    trail,
    ready: Promise.all([
      document.fonts.load('800 condensed 100px "Archivo Subset"'),
      document.fonts.load('700 condensed 100px "Archivo Subset"'),
    ]).then(() => repaints.forEach((repaint) => repaint())),
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
  });

  return { add, paint, track, label, sticker: stickerMaterial, slot: slotMaterial, finish };
}
