// Floor plan of underfloor-heating circuits, drawn behind a section by HeatLoops.astro.
// Units are plan units. The SVG scales them with `slice`, so one unit is about one CSS pixel on desktop.

export const PLAN_W = 1600;
export const PLAN_H = 1000;

const S = 30; // distance between neighbouring pipes
const ROUND = 4 * S; // corner radius of the outermost pipe; inner pipes stay concentric
const K = 0.5523; // cubic handle length for a quarter circle

interface Vertex {
  x: number;
  y: number;
  r: number;
}

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'spiral' | 'meander';
  // Side where both pipe ends leave the room. `flip` takes the other corner on that side.
  exit: 'left' | 'right' | 'top' | 'bottom';
  flip?: boolean;
  lead: number;
  leadRadius?: number;
  // Extra global points: before the supply end (far to near) and after the return end (near to far).
  routeIn?: Vertex[];
  routeOut?: Vertex[];
}

// Counter-flow spiral ("ślimak"): the supply runs inwards, turns in the middle,
// and the return runs outwards between the supply rings. Both ends leave at local (0, 0).
function spiral(w: number, h: number): { pts: Vertex[]; vIn: number; vOut: number } {
  const g = 2 * S;
  const n = Math.max(1, Math.floor((Math.min(w, h) - S) / (2 * g)));
  const ring = (inset: number): [number, number][] => {
    let l = inset;
    let t = inset;
    let r = w - inset;
    let b = h - inset;
    const pts: [number, number][] = [[l, t]];
    for (let k = 0; k < n; k++) {
      pts.push([r, t], [r, b], [l, b], [l, t + g]);
      t += g;
      r -= g;
      b -= g;
      l += g;
    }
    return pts;
  };
  const supply = ring(0);
  const back = ring(S);
  back[back.length - 1]![1] = supply[supply.length - 1]![1];
  const radius = ([u, v]: [number, number]) => Math.max(ROUND - Math.min(u, v, w - u, h - v), S / 2);
  const pts = [...supply, ...back.reverse()].map(([x, y]) => ({ x, y, r: radius([x, y]) }));
  return { pts, vIn: 0, vOut: S };
}

// Serpentine ("wężownica"): rows across the room, the return runs back along the far side and the top.
function meander(w: number, h: number): { pts: Vertex[]; vIn: number; vOut: number } {
  let m = Math.floor((h - 1.5 * S) / S);
  if (m % 2) m -= 1;
  const uL = S / 2;
  const uR = w - S;
  const pts: Vertex[] = [];
  for (let i = 0; i <= m; i++) {
    const v = S + i * S;
    const end = i % 2 === 0 ? uR : uL;
    pts.push({ x: end, y: v, r: S });
    if (i < m) pts.push({ x: end, y: v + S, r: S });
  }
  pts.push({ x: w, y: S + m * S, r: S }, { x: w, y: 0, r: S });
  // First row starts at the room edge; the lead is added by the caller.
  pts.unshift({ x: 0, y: S, r: 0 });
  pts.push({ x: 0, y: 0, r: 0 });
  return { pts, vIn: S, vOut: 0 };
}

function place(room: Room): Vertex[] {
  const swap = room.exit === 'top' || room.exit === 'bottom';
  const lw = swap ? room.h : room.w;
  const lh = swap ? room.w : room.h;
  const { pts, vIn, vOut } = room.kind === 'spiral' ? spiral(lw, lh) : meander(lw, lh);

  const toGlobal = (p: Vertex): Vertex => {
    const v = room.flip ? lh - p.y : p.y;
    const u = p.x;
    switch (room.exit) {
      case 'left':
        return { x: room.x + u, y: room.y + v, r: p.r };
      case 'right':
        return { x: room.x + room.w - u, y: room.y + v, r: p.r };
      case 'top':
        return { x: room.x + v, y: room.y + u, r: p.r };
      case 'bottom':
        return { x: room.x + v, y: room.y + room.h - u, r: p.r };
    }
  };

  const leadR = room.leadRadius ?? 0;
  return [
    ...(room.routeIn ?? []),
    toGlobal({ x: -room.lead, y: vIn, r: leadR }),
    ...pts.map(toGlobal),
    toGlobal({ x: -room.lead, y: vOut, r: leadR }),
    ...(room.routeOut ?? []),
  ];
}

const f = (n: number) => String(Math.round(n * 10) / 10);

function toPath(pts: Vertex[]): string {
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  let d = `M${f(first.x)} ${f(first.y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const ax = p1.x - p0.x;
    const ay = p1.y - p0.y;
    const bx = p2.x - p1.x;
    const by = p2.y - p1.y;
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (!la || !lb || Math.abs(ax * by - ay * bx) < 1e-6) continue;
    const r = Math.min(p1.r, la / 2, lb / 2);
    if (r <= 0) {
      d += `L${f(p1.x)} ${f(p1.y)}`;
      continue;
    }
    const ux = ax / la;
    const uy = ay / la;
    const vx = bx / lb;
    const vy = by / lb;
    const sx = p1.x - ux * r;
    const sy = p1.y - uy * r;
    const ex = p1.x + vx * r;
    const ey = p1.y + vy * r;
    d += `L${f(sx)} ${f(sy)}C${f(sx + ux * r * K)} ${f(sy + uy * r * K)} ${f(ex - vx * r * K)} ${f(ey - vy * r * K)} ${f(ex)} ${f(ey)}`;
  }
  return `${d}L${f(last.x)} ${f(last.y)}`;
}

// Six heating circuits under one floor. A corridor between the left and middle column
// carries the leads of the middle room, so phones (which see the middle third) still get a full loop.
const corridorIn = 595;
const corridorOut = corridorIn - S;
const rooms: Room[] = [
  { x: 40, y: 40, w: 480, h: 520, kind: 'spiral', exit: 'left', lead: 80 },
  { x: 40, y: 600, w: 480, h: 360, kind: 'meander', exit: 'left', lead: 80 },
  { x: 640, y: 40, w: 420, h: 300, kind: 'meander', exit: 'top', lead: 80 },
  {
    x: 640,
    y: 380,
    w: 420,
    h: 580,
    kind: 'spiral',
    exit: 'left',
    lead: 640 - corridorIn,
    leadRadius: S,
    routeIn: [{ x: corridorIn, y: -40, r: 0 }],
    routeOut: [
      { x: corridorOut, y: 380 + S, r: 2 * S },
      { x: corridorOut, y: -40, r: 0 },
    ],
  },
  { x: 1100, y: 40, w: 460, h: 400, kind: 'meander', exit: 'top', flip: true, lead: 80 },
  { x: 1100, y: 480, w: 460, h: 480, kind: 'spiral', exit: 'right', flip: true, lead: 80 },
];

export function floorPlan(): string[] {
  return rooms.map((room) => toPath(place(room)));
}
