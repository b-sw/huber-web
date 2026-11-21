// Renders the exploded manifold and reports where each part sits on screen.
// The page owns the labels. This module only draws, picks parts under the pointer and projects anchors.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { PartId } from '../../data/manifold';
import { buildManifold, type Anchor } from './manifold-model';

export interface Frame {
  // Spread of the parts: 0 assembled, 1 fully apart.
  p: number;
  points: Map<PartId, Point>;
  // Screen box of the fully spread manifold.
  box: { left: number; right: number; top: number; bottom: number };
  trail: [Point, Point];
}

interface Point {
  x: number;
  y: number;
}

export interface ManifoldView {
  highlight(part: PartId | null): void;
  setBrand(text: string): void;
  // Framing: how much of the canvas width the manifold may take.
  setFill(width: number): void;
}

interface Options {
  canvas: HTMLCanvasElement;
  still: boolean;
  progress(): number;
  onPick(part: PartId | null): void;
  onFrame(frame: Frame): void;
}

const YAW = THREE.MathUtils.degToRad(-24);
const PITCH = THREE.MathUtils.degToRad(9);
const FOV = 22;
// How far outside a zone, in CSS px, the pointer still picks it.
const HIT_PAD = 16;

const cornersOf = (box: THREE.Box3) =>
  [0, 1, 2, 3, 4, 5, 6, 7].map(
    (i) =>
      new THREE.Vector3(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      ),
  );

export function mountManifold({ canvas, still, progress, onPick, onFrame }: Options): ManifoldView | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xfff2e2, 1.6);
  key.position.set(-300, 500, 400);
  scene.add(key);

  const model = buildManifold();
  scene.add(model.root);

  const zones = new Map<string, { part: PartId; members: { object: THREE.Object3D; corners: THREE.Vector3[] }[] }>();
  for (const piece of model.pieces) {
    const { object } = piece;
    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.scale.setScalar(1);
    object.updateMatrixWorld(true);
    const zone = zones.get(piece.zone) ?? { part: piece.part, members: [] };
    zone.members.push({ object, corners: cornersOf(new THREE.Box3().setFromObject(object)) });
    zones.set(piece.zone, zone);
  }

  // Frame the manifold by its fully spread size, so the camera never moves while the parts travel.
  for (const piece of model.pieces) {
    piece.object.position.copy(piece.home).add(piece.offset);
    piece.object.rotation.copy(piece.rest);
    piece.object.scale.setScalar(piece.grow);
  }
  const spread = new THREE.Box3().setFromObject(model.root);
  const center = spread.getCenter(new THREE.Vector3());
  const size = spread.getSize(new THREE.Vector3());
  const corners = cornersOf(spread);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 6000);
  let width = 1;
  let height = 1;
  let fill = 0.44;
  let distance = 1000;

  const fit = () => {
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const byHeight = (size.y * 0.5) / (tan * 0.9);
    const byWidth = (Math.max(size.x, size.z) * 0.5) / (tan * camera.aspect * fill);
    distance = Math.max(byHeight, byWidth) + size.z * 0.5;
  };

  const resize = () => {
    width = canvas.clientWidth || 1;
    height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    fit();
    request();
  };

  let p = still ? 1 : progress();
  let yaw = YAW;
  let pitch = PITCH;
  let aimYaw = YAW;
  let aimPitch = PITCH;
  let inView = false;
  let raf = 0;
  const running = () => inView && !still && document.visibilityState === 'visible';

  const projected = new THREE.Vector3();
  const toScreen = (v: THREE.Vector3) => {
    projected.copy(v).project(camera);
    return { x: (projected.x * 0.5 + 0.5) * width, y: (-projected.y * 0.5 + 0.5) * height };
  };

  const pose = (t: number) => {
    for (const piece of model.pieces) {
      const { object, rest } = piece;
      const float = still ? 0 : p;
      object.position.copy(piece.home).addScaledVector(piece.offset, p);
      object.position.y += Math.sin(t * 0.9 + piece.phase) * 2.2 * float;
      object.rotation.set(rest.x, rest.y + piece.spin * p, rest.z + Math.sin(t * 0.6 + piece.phase) * 0.012 * float);
      object.scale.setScalar(1 + (piece.grow - 1) * p);
    }
    const sway = still ? 0 : Math.sin(t * 0.25) * THREE.MathUtils.degToRad(2.5);
    camera.position.set(
      center.x + distance * Math.sin(yaw + sway) * Math.cos(pitch),
      center.y + distance * Math.sin(pitch),
      center.z + distance * Math.cos(yaw + sway) * Math.cos(pitch),
    );
    camera.lookAt(center);
    camera.updateMatrixWorld();
  };

  const anchorOnScreen = ({ object, point }: Anchor) => toScreen(object.localToWorld(point.clone()));

  const report = () => {
    const points = new Map<PartId, Point>();
    for (const [part, anchor] of Object.entries(model.anchors) as [PartId, Anchor][]) {
      points.set(part, anchorOnScreen(anchor));
    }
    const box = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (const corner of corners) {
      const { x, y } = toScreen(corner);
      box.left = Math.min(box.left, x);
      box.right = Math.max(box.right, x);
      box.top = Math.min(box.top, y);
      box.bottom = Math.max(box.bottom, y);
    }
    onFrame({ p, points, box, trail: [anchorOnScreen(model.trail[0]), anchorOnScreen(model.trail[1])] });
  };

  const frame = (now: number) => {
    raf = 0;
    const target = still ? 1 : progress();
    p += (target - p) * 0.12;
    if (Math.abs(target - p) < 0.0005) p = target;
    yaw += (aimYaw - yaw) * 0.06;
    pitch += (aimPitch - pitch) * 0.06;
    pose(now / 1000);
    renderer.render(scene, camera);
    report();
    if (running()) request();
  };

  function request() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // Off the parts themselves, the pointer picks the nearest zone box on screen. Inside several boxes, the smallest wins.
  const corner = new THREE.Vector3();
  const zoneAt = (x: number, y: number): PartId | null => {
    let best: PartId | null = null;
    let bestDistance = HIT_PAD;
    let bestArea = Infinity;
    for (const { part, members } of zones.values()) {
      let left = Infinity;
      let right = -Infinity;
      let top = Infinity;
      let bottom = -Infinity;
      for (const { object, corners } of members) {
        for (const c of corners) {
          const s = toScreen(corner.copy(c).applyMatrix4(object.matrixWorld));
          left = Math.min(left, s.x);
          right = Math.max(right, s.x);
          top = Math.min(top, s.y);
          bottom = Math.max(bottom, s.y);
        }
      }
      const distance = Math.hypot(Math.max(left - x, 0, x - right), Math.max(top - y, 0, y - bottom));
      const area = (right - left) * (bottom - top);
      if (distance < bestDistance || (distance === bestDistance && area < bestArea)) {
        best = part;
        bestDistance = distance;
        bestArea = area;
      }
    }
    return best;
  };

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pick = (event: PointerEvent): PartId | null => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    ndc.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const [hit] = raycaster.intersectObject(model.root, true);
    return (hit?.object.userData.part as PartId | undefined) ?? zoneAt(x, y);
  };

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    if (!still) {
      const rect = canvas.getBoundingClientRect();
      aimYaw = YAW + ((event.clientX - rect.left) / rect.width - 0.5) * THREE.MathUtils.degToRad(10);
      aimPitch = PITCH + ((event.clientY - rect.top) / rect.height - 0.5) * THREE.MathUtils.degToRad(6);
    }
    const part = pick(event);
    canvas.style.cursor = part ? 'pointer' : '';
    onPick(part);
  });
  canvas.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') return;
    aimYaw = YAW;
    aimPitch = PITCH;
    request();
  });
  canvas.addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'mouse') onPick(pick(event));
  });

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver((entries) => {
    inView = entries.some((e) => e.isIntersecting);
    request();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => running() && request());
  model.ready.then(request);
  resize();

  return {
    highlight(part) {
      model.highlight(part);
      request();
    },
    setBrand(text) {
      model.setBrand(text);
      request();
    },
    setFill(value) {
      if (value === fill) return;
      fill = value;
      fit();
      request();
    },
  };
}
