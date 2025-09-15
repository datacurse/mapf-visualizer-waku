import Two from "two.js";
import { drawRobot } from "./draw";

function vec(x: number, y: number) {
  return { x, y };
}
function add(a: { x: number; y: number }, b: { x: number; y: number }) {
  return vec(a.x + b.x, a.y + b.y);
}
function sub(a: { x: number; y: number }, b: { x: number; y: number }) {
  return vec(a.x - b.x, a.y - b.y);
}
function mul(a: { x: number; y: number }, k: number) {
  return vec(a.x * k, a.y * k);
}
function len(a: { x: number; y: number }) {
  return Math.hypot(a.x, a.y);
}
function angleDiff(a: number, b: number) {
  return ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

class Grid {
  w: number;
  h: number;
  adj: Map<number, number[]>;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.adj = new Map();
  }
  id(x: number, y: number) {
    return y * this.w + x;
  }
  xy(id: number) {
    return { x: id % this.w, y: Math.floor(id / this.w) };
  }
  pos(id: number) {
    const p = this.xy(id);
    return vec(p.x, p.y);
  }
  neighbors(id: number) {
    if (this.adj.has(id)) return this.adj.get(id)!;
    const { x, y } = this.xy(id);
    const n: number[] = [];
    if (x > 0) n.push(this.id(x - 1, y));
    if (x + 1 < this.w) n.push(this.id(x + 1, y));
    if (y > 0) n.push(this.id(x, y - 1));
    if (y + 1 < this.h) n.push(this.id(x, y + 1));
    this.adj.set(id, n);
    return n;
  }
  findPath(start: number, goal: number) {
    if (start === goal) return [start];
    const queue = [start];
    const parent = new Map<number, number | null>();
    parent.set(start, null);
    const visited = new Set([start]);
    let found = false;
    while (queue.length > 0) {
      const u = queue.shift()!;
      for (const v of this.neighbors(u)) {
        if (!visited.has(v)) {
          visited.add(v);
          parent.set(v, u);
          queue.push(v);
          if (v === goal) {
            found = true;
            break;
          }
        }
      }
      if (found) break;
    }
    if (!found) return null;
    const path: number[] = [];
    let current: number | null = goal;
    while (current !== null) {
      path.push(current);
      current = parent.get(current);
    }
    path.reverse();
    return path;
  }
}

class Reservations {
  vertexOwner: Map<number, number>;
  edgeOwner: Map<string, number>;

  constructor() {
    this.vertexOwner = new Map();
    this.edgeOwner = new Map();
  }
  key(u: number, v: number) {
    return `${u}->${v}`;
  }
  tryLockMove(agent: number, u: number, v: number) {
    const vo = this.vertexOwner.get(v);
    if (vo !== undefined && vo !== agent) return false;
    const k = this.key(u, v),
      kr = this.key(v, u);
    const eo = this.edgeOwner.get(k),
      eor = this.edgeOwner.get(kr);
    if ((eo !== undefined && eo !== agent) || (eor !== undefined && eor !== agent)) return false;
    this.vertexOwner.set(v, agent);
    this.edgeOwner.set(k, agent);
    return true;
  }
  releaseAfterArrive(agent: number, from: number, to: number) {
    const k = this.key(from, to);
    if (this.edgeOwner.get(k) === agent) this.edgeOwner.delete(k);
    if (this.vertexOwner.get(from) === agent) this.vertexOwner.delete(from);
  }
  occupyVertex(agent: number, v: number) {
    this.vertexOwner.set(v, agent);
  }
}

class Agent {
  id: number;
  grid: Grid;
  res: Reservations;
  path: number[];
  idx: number;
  from: number;
  to: number | null;
  pos: { x: number; y: number };
  heading: number;
  v: number;
  kin: { vmax: number; a: number; d: number; rotRate: number; nodeRadius: number; headingTol: number };
  state: "contracted" | "extended";
  g: any;
  size = 60; // Matches drawRobot size from draw.ts

  constructor(id: number, grid: Grid, res: Reservations, path: number[], kin: any, color: string, two: Two) {
    this.id = id;
    this.grid = grid;
    this.res = res;
    this.path = path;
    this.idx = 0;
    this.from = path[0];
    this.to = null;
    this.pos = this.grid.pos(this.from);
    this.heading = 0;
    this.v = 0;
    this.kin = kin;
    this.state = "contracted";
    this.res.occupyVertex(this.id, this.from);
    this.g = drawRobot(two, this.pos.x * 100, this.pos.y * 100, this.size, color, String(id));
  }
  done() {
    return this.idx >= this.path.length - 1 && this.state === "contracted";
  }
  desiredNext() {
    return this.idx >= this.path.length - 1 ? null : this.path[this.idx + 1];
  }
  tryStartMove() {
    const vNext = this.desiredNext();
    if (vNext == null) return;
    if (!this.res.tryLockMove(this.id, this.from, vNext)) return;
    this.to = vNext;
    this.state = "extended";
  }
  step(dt: number) {
    if (this.done()) return;
    if (this.state === "contracted") {
      this.tryStartMove();
      return;
    }
    const target = this.grid.pos(this.to!);
    const dir = sub(target, this.pos);
    const dist = len(dir);
    if (dist <= this.kin.nodeRadius) {
      this.pos = target;
      this.v = 0;
      this.res.releaseAfterArrive(this.id, this.from, this.to!);
      this.res.occupyVertex(this.id, this.to!);
      this.from = this.to!;
      this.idx += 1;
      this.to = null;
      this.state = "contracted";
      return;
    }
    const needHeading = Math.atan2(dir.y, dir.x);
    const dh = angleDiff(needHeading, this.heading);
    const maxTurn = this.kin.rotRate * dt;
    if (Math.abs(dh) > this.kin.headingTol) {
      this.heading += Math.sign(dh) * Math.min(Math.abs(dh), maxTurn);
      this.v = 0;
      return;
    }
    this.heading = needHeading;
    const braking = (this.v * this.v) / (2 * this.kin.d);
    if (this.v > 0 && dist <= braking) {
      this.v = Math.max(0, this.v - this.kin.d * dt);
    } else {
      this.v = Math.min(this.kin.vmax, this.v + this.kin.a * dt);
    }
    const forward = vec(Math.cos(this.heading), Math.sin(this.heading));
    const ds = this.v * dt;
    const cappedDs = Math.min(ds, dist);
    const stepVec = mul(forward, cappedDs);
    const nextPos = add(this.pos, stepVec);
    const nextDist = dist - cappedDs;
    if (nextDist <= this.kin.nodeRadius) {
      this.pos = target;
      this.v = 0;
      this.res.releaseAfterArrive(this.id, this.from, this.to!);
      this.res.occupyVertex(this.id, this.to!);
      this.from = this.to!;
      this.idx += 1;
      this.to = null;
      this.state = "contracted";
    } else {
      this.pos = nextPos;
    }
  }
  draw(s: number) {
    this.g.translation.set(this.pos.x * s, this.pos.y * s);
    this.g.rotation = this.heading;
  }
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class TwoController {
  private two: Two | null = null;
  private agents: Agent[] = [];
  private grid: Grid | null = null;
  private res: Reservations | null = null;
  private world: any = null;
  private gridLayer: any = null;
  private nodeLayer: any = null;
  private agentLayer: any = null;
  private lastTime: number = 0;
  private unbindUpdate: (() => void) | null = null;
  private s: number = 100;

  mount(host: HTMLElement) {
    this.destroy()
    this.two = new Two({ type: Two.Types.svg, fitted: true, autostart: true }).appendTo(host)

    const two = this.two!

    this.grid = new Grid(7, 7)
    this.res = new Reservations()
    const baseKin = {
      vmax: 1.6,
      a: 1.2,
      d: 1.8,
      rotRate: Math.PI,
      nodeRadius: 0.001,
      headingTol: 0.03,
    }
    const kins = [
      { ...baseKin, vmax: 1.0 },
      { ...baseKin, vmax: 1.4 },
      { ...baseKin, vmax: 1.8 },
      { ...baseKin, vmax: 2.2 },
    ]
    const aPath = [this.grid.id(0, 3), this.grid.id(1, 3), this.grid.id(2, 3), this.grid.id(3, 3), this.grid.id(4, 3), this.grid.id(5, 3), this.grid.id(6, 3)]
    const bPath = [this.grid.id(3, 0), this.grid.id(3, 1), this.grid.id(3, 2), this.grid.id(3, 3), this.grid.id(3, 4), this.grid.id(3, 5), this.grid.id(3, 6)]
    const cPath = [this.grid.id(0, 0), this.grid.id(1, 0), this.grid.id(2, 0), this.grid.id(3, 0), this.grid.id(4, 0), this.grid.id(5, 0), this.grid.id(6, 0)]
    const dPath = [this.grid.id(6, 6), this.grid.id(5, 6), this.grid.id(4, 6), this.grid.id(3, 6), this.grid.id(2, 6), this.grid.id(1, 6), this.grid.id(0, 6)]
    this.agents = [
      new Agent(0, this.grid, this.res, aPath, kins[0], "#FF5A5A", two),
      new Agent(1, this.grid, this.res, bPath, kins[1], "#4A90E2", two),
      new Agent(2, this.grid, this.res, cPath, kins[2], "#50E3C2", two),
      new Agent(3, this.grid, this.res, dPath, kins[3], "#F5A623", two),
    ]

    this.world = this.two.makeGroup()
    this.gridLayer = this.two.makeGroup()
    this.nodeLayer = this.two.makeGroup()
    this.agentLayer = this.two.makeGroup()
    this.world.add(this.gridLayer, this.nodeLayer, this.agentLayer)
    this.agents.forEach((a) => this.agentLayer.add(a.g))

    this.drawGrid()
    this.layout()

    this.lastTime = performance.now()
    const onUpdate = () => this.update()
    this.two.bind("update", onUpdate)
    this.unbindUpdate = () => this.two?.unbind("update", onUpdate)
  }


  private drawGrid() {
    if (!this.two || !this.grid) return;
    this.gridLayer.remove(this.gridLayer.children);
    this.nodeLayer.remove(this.nodeLayer.children);
    for (let y = 0; y < this.grid.h; y++) {
      for (let x = 0; x < this.grid.w; x++) {
        const u = this.grid.id(x, y);
        const pu = this.grid.pos(u);
        const ppx = pu.x * this.s, ppy = pu.y * this.s;
        const dot = this.two.makeCircle(ppx, ppy, 4);
        dot.fill = "#777";
        dot.stroke = "transparent";
        this.nodeLayer.add(dot);
        const ns = this.grid.neighbors(u);
        for (const v of ns) {
          const pv = this.grid.pos(v);
          if (v < u) continue;
          const line = this.two.makeLine(ppx, ppy, pv.x * this.s, pv.y * this.s);
          line.stroke = "#ddd";
          line.linewidth = 2;
          this.gridLayer.add(line);
        }
      }
    }
  }

  private layout() {
    if (!this.two || !this.grid) return;
    const gw = (this.grid.w - 1) * this.s;
    const gh = (this.grid.h - 1) * this.s;
    const padding = Math.min(this.two.width, this.two.height) * 0.08;
    const scale = Math.min((this.two.width - padding) / gw, (this.two.height - padding) / gh);
    this.world.scale = scale;
    this.world.translation.set(
      this.two.width / 2 - (gw / 2) * scale,
      this.two.height / 2 - (gh / 2) * scale
    );
    this.two.update();
  }

  private update() {
    if (!this.two) return;
    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(0.05, dt);
    const order = shuffle([...this.agents]);
    for (const a of order) a.step(dt);
    const allDone = this.agents.every((a) => a.done());
    if (allDone) {
      const occupied = new Set(this.agents.map((a) => a.from));
      const allIds = Array.from({ length: this.grid!.w * this.grid!.h }, (_, i) => i);
      const available = allIds.filter((id) => !occupied.has(id));
      shuffle(available);
      this.agents.forEach((a, i) => {
        const goal = available[i];
        const path = this.grid!.findPath(a.from, goal);
        if (path) {
          a.path = path;
          a.idx = 0;
          a.to = null;
          a.state = "contracted";
        }
      });
    }
    for (const a of this.agents) a.draw(this.s);
  }

  destroy() {
    this.unbindUpdate?.();
    this.unbindUpdate = null;
    this.two?.clear();
    this.two?.pause();
    this.two = null;
    this.agents = [];
    this.grid = null;
    this.res = null;
    this.world = null;
    this.gridLayer = null;
    this.nodeLayer = null;
    this.agentLayer = null;
  }
}