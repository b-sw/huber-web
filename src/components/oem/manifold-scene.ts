// Renders the exploded manifold and reports where each part sits on screen.
// The page owns the labels. This module only draws, picks parts under the pointer and projects anchors.
import * as THREE from 'three';
import type { PartId } from '../../data/manifold';
import type { Material } from '../../data/products';
import { buildBrass } from './manifold-brass';
import type { Anchor, ManifoldModel, Piece } from './manifold-kit';
import { studio } from './manifold-shading';
import { buildSteel } from './manifold-steel';

export interface Frame {
  // The model on screen. It can lag behind the switch while the parts fold.
  material: Material;
  // A swap runs, from the first fold until the parts settle again.
  swapping: boolean;
  // Spread of the parts: 0 assembled, 1 fully apart.
  p: number;
  points: Map<PartId, Point>;
  // The same anchors without the float, the camera sway and the pointer tilt. Labels sit here and stay still.
  rest: Map<PartId, Point>;
  // Screen box of the fully spread manifold, projected with the rest camera.
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
  show(material: Material): void;
}

interface Options {
  canvas: HTMLCanvasElement;
  still: boolean;
  material: Material;
  progress(): number;
  onPick(part: PartId | null): void;
  onFrame(frame: Frame): void;
}

interface Staged {
  material: Material;
  model: ManifoldModel;
  pieces: Map<THREE.Object3D, Piece>;
  zones: Map<string, { part: PartId; members: { object: THREE.Object3D; corners: THREE.Vector3[] }[] }>;
  center: THREE.Vector3;
  size: THREE.Vector3;
  corners: THREE.Vector3[];
}

const BUILDERS: Record<Material, () => ManifoldModel> = { mosiadz: buildBrass, inox: buildSteel };

const YAW = THREE.MathUtils.degToRad(-24);
const PITCH = THREE.MathUtils.degToRad(9);
const FOV = 22;
const SWAP_TURN = THREE.MathUtils.degToRad(16);
// A swap folds the parts slowly at first and fastest as they meet, so the model changes at full speed.
// The new parts spread on the mirrored curve in the same time, so the change has no snap.
const FOLD_MS = 300;
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

export function mountManifold({ canvas, still, material, progress, onPick, onFrame }: Options): ManifoldView | null {
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
  scene.environment = pmrem.fromScene(studio(), 0.02, 0.1, 100, { size: 512 }).texture;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xfff2e2, 1.6);
  key.position.set(-300, 500, 400);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 6000);
  const restCamera = camera.clone();

  const staged = new Map<Material, Staged>();
  const warmup = new THREE.WebGLRenderTarget(1, 1);
  const stage = (material: Material): Staged => {
    const known = staged.get(material);
    if (known) return known;
    const model = BUILDERS[material]();

    const zones: Staged['zones'] = new Map();
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

    // Frame the manifold by its fully spread size, so the camera stays put while the parts travel on scroll.
    for (const piece of model.pieces) {
      piece.object.position.copy(piece.home).add(piece.offset);
      piece.object.rotation.copy(piece.rest);
      piece.object.scale.setScalar(piece.grow);
    }
    const spread = new THREE.Box3().setFromObject(model.root);

    // A highlight fades the other parts, which needs other shader variants. Compile them now, not on the first hover.
    // The second pass fades the part that the first pass kept solid.
    scene.add(model.root);
    const [first, second] = new Set(model.pieces.map((piece) => piece.part));
    for (const part of [first, second]) {
      model.highlight(part);
      renderer.compile(scene, camera);
    }
    model.highlight(null);
    // Draw it once off screen, so its first frame on screen does not upload every buffer and texture.
    renderer.setRenderTarget(warmup);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    scene.remove(model.root);
    model.ready.then(request);

    const built = {
      material,
      model,
      pieces: new Map(model.pieces.map((piece) => [piece.object, piece])),
      zones,
      center: spread.getCenter(new THREE.Vector3()),
      size: spread.getSize(new THREE.Vector3()),
      corners: cornersOf(spread),
    };
    staged.set(material, built);
    return built;
  };

  let shown = stage(material);
  scene.add(shown.model.root);
  let pending: Staged | null = null;
  let swing = 0;
  let fold: { start: number; p: number; swing: number } | null = null;
  let spread: { start: number } | null = null;
  let swapping = false;
  let brand = '';
  let selected: PartId | null = null;

  let width = 1;
  let height = 1;
  let fill = 0.44;
  let distance = 1000;
  const easedCenter = new THREE.Vector3();
  let easedDistance = distance;

  const fit = () => {
    const { size } = shown;
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const byHeight = (size.y * 0.5) / (tan * 0.9);
    const byWidth = (Math.max(size.x, size.z) * 0.5) / (tan * camera.aspect * fill);
    distance = Math.max(byHeight, byWidth) + size.z * 0.5;
  };

  // A new size or layout frames the model at once. Only a swap eases into the new framing.
  const refit = () => {
    fit();
    easedDistance = distance;
    easedCenter.copy(shown.center);
  };

  const resize = () => {
    width = canvas.clientWidth || 1;
    height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    for (const lens of [camera, restCamera]) {
      lens.aspect = width / height;
      lens.updateProjectionMatrix();
    }
    refit();
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
  const toScreen = (v: THREE.Vector3, lens = camera) => {
    projected.copy(v).project(lens);
    return { x: (projected.x * 0.5 + 0.5) * width, y: (-projected.y * 0.5 + 0.5) * height };
  };

  // The float only moves the drawn pieces, not the rest pose.
  const settle = (piece: Piece, target: THREE.Object3D, t: number, float: number) => {
    const { rest } = piece;
    target.position.copy(piece.home).addScaledVector(piece.offset, p);
    target.position.y += Math.sin(t * 0.9 + piece.phase) * 2.2 * float;
    target.rotation.set(rest.x, rest.y + piece.spin * p, rest.z + Math.sin(t * 0.6 + piece.phase) * 0.012 * float);
    target.scale.setScalar(1 + (piece.grow - 1) * p);
  };

  const aim = (lens: THREE.PerspectiveCamera, turn: number, tilt: number, center: THREE.Vector3, far: number) => {
    lens.position.set(
      center.x + far * Math.sin(turn) * Math.cos(tilt),
      center.y + far * Math.sin(tilt),
      center.z + far * Math.cos(turn) * Math.cos(tilt),
    );
    lens.lookAt(center);
    lens.updateMatrixWorld();
  };

  const pose = (t: number) => {
    for (const piece of shown.model.pieces) settle(piece, piece.object, t, still ? 0 : p);
    const sway = still ? 0 : Math.sin(t * 0.25) * THREE.MathUtils.degToRad(2.5);
    aim(camera, yaw + sway + swing * SWAP_TURN, pitch, easedCenter, easedDistance);
    aim(restCamera, YAW, PITCH, shown.center, distance);
  };

  const anchorOnScreen = ({ object, point }: Anchor) => toScreen(object.localToWorld(point.clone()));

  const resting = new THREE.Object3D();
  const anchorAtRest = ({ object, point }: Anchor) => {
    settle(shown.pieces.get(object)!, resting, 0, 0);
    resting.updateMatrix();
    return toScreen(point.clone().applyMatrix4(resting.matrix), restCamera);
  };

  const report = () => {
    const { model, corners } = shown;
    const points = new Map<PartId, Point>();
    const rest = new Map<PartId, Point>();
    for (const [part, anchor] of Object.entries(model.anchors) as [PartId, Anchor][]) {
      points.set(part, anchorOnScreen(anchor));
      rest.set(part, anchorAtRest(anchor));
    }
    const box = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (const corner of corners) {
      const { x, y } = toScreen(corner, restCamera);
      box.left = Math.min(box.left, x);
      box.right = Math.max(box.right, x);
      box.top = Math.min(box.top, y);
      box.bottom = Math.max(box.bottom, y);
    }
    const trail: [Point, Point] = [anchorOnScreen(model.trail[0]), anchorOnScreen(model.trail[1])];
    onFrame({ material: shown.material, swapping, p, points, rest, box, trail });
  };

  const swap = () => {
    scene.remove(shown.model.root);
    shown = pending!;
    pending = null;
    scene.add(shown.model.root);
    if (brand) shown.model.setBrand(brand);
    shown.model.highlight(selected);
    fit();
  };

  let before = 0;
  const frame = (now: number) => {
    raf = 0;
    // Easing rates are per frame at 60 fps. A slower or faster screen gets the same timing.
    const frames = before ? Math.min(now - before, 100) / (1000 / 60) : 1;
    before = now;
    const ease = (rate: number) => 1 - Math.pow(1 - rate, frames);
    if (pending) {
      // The fold starts on the first frame, so a slow click handler does not skip its start.
      fold ??= { start: now, p, swing };
      spread = null;
      swapping = true;
      const t = Math.min(1, (now - fold.start) / (FOLD_MS * Math.max(0.5, fold.p)));
      p = fold.p * (1 - t * t);
      swing = fold.swing + (1 - fold.swing) * t * t;
      if (t === 1) {
        swap();
        spread = { start: now };
      }
    } else {
      fold = null;
      const target = still ? 1 : progress();
      // The camera turns back to its start angle while the parts spread, so only the material changes at the swap.
      if (spread) {
        const t = Math.min(1, (now - spread.start) / FOLD_MS);
        p = target * (1 - (1 - t) * (1 - t));
        swing = (1 - t) * (1 - t);
        if (t === 1) spread = null;
      } else {
        p += (target - p) * ease(0.12);
        if (Math.abs(target - p) < 0.0005) p = target;
        swing -= swing * ease(0.12);
      }
      if (!spread && Math.abs(target - p) < 0.02) swapping = false;
    }
    easedCenter.lerp(shown.center, ease(0.12));
    easedDistance += (distance - easedDistance) * ease(0.12);
    yaw += (aimYaw - yaw) * ease(0.06);
    pitch += (aimPitch - pitch) * ease(0.06);
    pose(now / 1000);
    renderer.render(scene, camera);
    report();
    if (running() || pending) request();
  };

  // Build the other models while the page is idle, so the first swap starts without a pause.
  const whenIdle = (run: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(run) : setTimeout(run, 1500));
  whenIdle(() => (Object.keys(BUILDERS) as Material[]).forEach(stage));

  function request() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // Off the parts themselves, the pointer picks the nearest zone box on screen. Inside several boxes, the smallest wins.
  const corner = new THREE.Vector3();
  const zoneAt = (x: number, y: number): PartId | null => {
    let best: PartId | null = null;
    let bestDistance = HIT_PAD;
    let bestArea = Infinity;
    for (const { part, members } of shown.zones.values()) {
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
    const [hit] = raycaster.intersectObject(shown.model.root, true);
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
  resize();

  return {
    highlight(part) {
      selected = part;
      shown.model.highlight(part);
      request();
    },
    setBrand(text) {
      brand = text;
      shown.model.setBrand(text);
      request();
    },
    setFill(value) {
      if (value === fill) return;
      fill = value;
      refit();
      request();
    },
    show(material) {
      const next = stage(material);
      // Choosing the model on screen again before the parts fold together spreads them back.
      pending = next === shown ? null : next;
      if (still && pending) {
        swap();
        swing = 0;
        refit();
      }
      request();
    },
  };
}
