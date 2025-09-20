import Two from "two.js";
import { drawRobot } from "../ts/draw";

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
function manhattan(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

class Grid {
  w: number;
  h: number;
  adj: Map<number, number[]>;
  obstacles: Set<number>;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.adj = new Map();
    this.obstacles = new Set();
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

  addObstacle(id: number) {
    this.obstacles.add(id);
    this.adj.clear(); // reset cache since neighbors change
  }

  isObstacle(id: number) {
    return this.obstacles.has(id);
  }

  neighbors(id: number) {
    if (this.adj.has(id)) return this.adj.get(id)!;
    if (this.isObstacle(id)) return [];
    const { x, y } = this.xy(id);
    const n: number[] = [];
    if (x > 0 && !this.isObstacle(this.id(x - 1, y))) n.push(this.id(x - 1, y));
    if (x + 1 < this.w && !this.isObstacle(this.id(x + 1, y))) n.push(this.id(x + 1, y));
    if (y > 0 && !this.isObstacle(this.id(x, y - 1))) n.push(this.id(x, y - 1));
    if (y + 1 < this.h && !this.isObstacle(this.id(x, y + 1))) n.push(this.id(x, y + 1));
    this.adj.set(id, n);
    return n;
  }
}


class PIBT {
  grid: Grid;
  NIL: number;
  NIL_COORD: number;
  occupied_now: number[];
  occupied_nxt: number[];

  constructor(grid: Grid) {
    this.grid = grid;
    this.NIL = 1e9;
    this.NIL_COORD = -1;
    this.occupied_now = [];
    this.occupied_nxt = [];
  }

  funcPIBT(Q_from: number[], Q_to: number[], i: number, priorities: number[], dist: (agent: number, node: number) => number): boolean {
    let C = [Q_from[i], ...this.grid.neighbors(Q_from[i])];
    C.sort((a, b) => dist(i, a) - dist(i, b));
    for (const v of C) {
      if (this.occupied_nxt[v] !== this.NIL) continue;
      const j = this.occupied_now[v];
      if (j !== this.NIL && Q_to[j] === Q_from[i]) continue;
      Q_to[i] = v;
      this.occupied_nxt[v] = i;
      if (j !== this.NIL && Q_to[j] === this.NIL_COORD && !this.funcPIBT(Q_from, Q_to, j, priorities, dist)) {
        continue;
      }
      return true;
    }
    Q_to[i] = Q_from[i];
    this.occupied_nxt[Q_from[i]] = i;
    return false;
  }

  step(Q_from: number[], priorities: number[], dist: (agent: number, node: number) => number): number[] {
    const N = Q_from.length;
    const Q_to: number[] = new Array(N).fill(this.NIL_COORD);
    this.occupied_now = new Array(this.grid.w * this.grid.h).fill(this.NIL);
    for (let i = 0; i < N; i++) this.occupied_now[Q_from[i]] = i;
    this.occupied_nxt = new Array(this.grid.w * this.grid.h).fill(this.NIL);
    const A = Array.from({ length: N }, (_, k) => k).sort((a, b) => priorities[b] - priorities[a]);
    for (const i of A) if (Q_to[i] === this.NIL_COORD) this.funcPIBT(Q_from, Q_to, i, priorities, dist);
    return Q_to;
  }
}

type Task = { id: number; pickup: number; delivery: number; assignedTo?: number | null; picked?: boolean; done?: boolean };

class Agent {
  id: number;
  grid: Grid;
  current: number;
  next: number | null;
  pos: { x: number; y: number };
  heading: number;
  v: number;
  kin: { vmax: number; a: number; d: number; rotRate: number; nodeRadius: number; headingTol: number };
  state: "contracted" | "extended";
  g: any;
  size = 60;
  color: string;

  mode: "free" | "to_pickup" | "carrying";
  taskId: number | null;

  constructor(id: number, grid: Grid, start: number, kin: any, color: string, two: Two) {
    this.id = id;
    this.grid = grid;
    this.current = start;
    this.next = null;
    this.pos = this.grid.pos(this.current);
    this.heading = 0;
    this.v = 0;
    this.kin = kin;
    this.state = "contracted";
    this.color = color;
    this.g = drawRobot(two, this.pos.x * 100, this.pos.y * 100, this.size, color, String(id));
    this.mode = "free";
    this.taskId = null;
  }

  step(dt: number, multiplier: number) {
    if (this.state === "contracted") return;
    const target = this.grid.pos(this.next!);
    const dir = sub(target, this.pos);
    const dist = len(dir);
    if (dist <= this.kin.nodeRadius) {
      this.pos = target;
      this.v = 0;
      this.current = this.next!;
      this.next = null;
      this.state = "contracted";
      return;
    }
    const needHeading = Math.atan2(dir.y, dir.x);
    const dh = angleDiff(needHeading, this.heading);
    const maxTurn = this.kin.rotRate * multiplier * dt;
    if (Math.abs(dh) > this.kin.headingTol) {
      this.heading += Math.sign(dh) * Math.min(Math.abs(dh), maxTurn);
      this.v = 0;
      return;
    }
    this.heading = needHeading;
    const braking = (this.v * this.v) / (2 * this.kin.d * multiplier);
    if (this.v > 0 && dist <= braking) {
      this.v = Math.max(0, this.v - this.kin.d * multiplier * dt);
    } else {
      this.v = Math.min(this.kin.vmax * multiplier, this.v + this.kin.a * multiplier * dt);
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
      this.current = this.next!;
      this.next = null;
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

export class TwoControllerMapd {
  private two: Two | null = null;
  private agents: Agent[] = [];
  private grid: Grid | null = null;
  private pibt: PIBT | null = null;
  private world: any = null;
  private gridLayer: any = null;
  private nodeLayer: any = null;
  private pathLayer: any = null;
  private agentLayer: any = null;
  private pickupLayer: any = null;
  private deliveryLayer: any = null;
  private lastTime: number = 0;
  private unbindUpdate: (() => void) | null = null;
  private s: number = 100;
  private speedMultiplier: number = 10;

  private pickups: number[] = [];
  private deliveries: number[] = [];
  private tasks: Task[] = [];
  private colors: string[] = [
    "#FF5A5A", "#4A90E2", "#50E3C2", "#F5A623", "#7B1FA2",
    "#C2185B", "#009688", "#8BC34A", "#FFC107", "#795548",
    "#9E9E9E", "#607D8B", "#E91E63", "#3F51B5", "#00BCD4",
    "#CDDC39", "#FF9800", "#673AB7", "#2196F3", "#4CAF50"
  ];

  constructor() { }

  mount(host: HTMLElement) {
    this.destroy();
    this.two = new Two({ type: Two.Types.svg, fitted: true, autostart: true }).appendTo(host);

    const two = this.two!;
    const W = 8, H = 8;
    this.grid = new Grid(W, H);
    this.pibt = new PIBT(this.grid);

    this.pickups = [
      this.grid.id(5, 7),
      this.grid.id(2, 7),
    ];

    this.deliveries = [
      this.grid.id(0, 0),
      this.grid.id(0, 1),
      this.grid.id(0, 2),
      this.grid.id(0, 3),

      this.grid.id(2, 0),
      this.grid.id(2, 1),
      this.grid.id(2, 2),
      this.grid.id(2, 3),

      this.grid.id(5, 0),
      this.grid.id(5, 1),
      this.grid.id(5, 2),
      this.grid.id(5, 3),

      this.grid.id(7, 0),
      this.grid.id(7, 1),
      this.grid.id(7, 2),
      this.grid.id(7, 3),
    ];

    this.grid.addObstacle(this.grid.id(3, 0));
    this.grid.addObstacle(this.grid.id(3, 1));
    this.grid.addObstacle(this.grid.id(3, 2));
    this.grid.addObstacle(this.grid.id(3, 3));
    this.grid.addObstacle(this.grid.id(4, 0));
    this.grid.addObstacle(this.grid.id(4, 1));
    this.grid.addObstacle(this.grid.id(4, 2));
    this.grid.addObstacle(this.grid.id(4, 3));


    this.tasks = this.makeTasks(20);

    const baseKin = { vmax: 1.6, a: 1.2, d: 1.8, rotRate: Math.PI, nodeRadius: 0.001, headingTol: 0.03 };

    this.agents = [];
    for (let i = 0; i < 10; i++) {
      const start = this.pickups[i % this.pickups.length];
      const color = this.colors[i % this.colors.length];
      const a = new Agent(i, this.grid, start, baseKin, color, two);
      this.agents.push(a);
    }

    this.world = this.two.makeGroup();
    this.gridLayer = this.two.makeGroup();
    this.nodeLayer = this.two.makeGroup();
    this.pickupLayer = this.two.makeGroup();
    this.deliveryLayer = this.two.makeGroup();
    this.pathLayer = this.two.makeGroup();
    this.agentLayer = this.two.makeGroup();
    this.world.add(this.gridLayer, this.nodeLayer, this.pickupLayer, this.deliveryLayer, this.pathLayer, this.agentLayer);
    this.agents.forEach((a) => this.agentLayer.add(a.g));

    this.drawGrid();
    this.drawPD();
    this.layout();

    this.lastTime = performance.now();
    const onUpdate = () => this.update();
    this.two.bind("update", onUpdate);
    this.unbindUpdate = () => this.two?.unbind("update", onUpdate);
  }

  private makeTasks(n: number): Task[] {
    const t: Task[] = [];
    let id = 1;
    for (let i = 0; i < n; i++) {
      const pu = this.pickups[i % this.pickups.length];
      const di = this.deliveries[i % this.deliveries.length];
      t.push({ id: id++, pickup: pu, delivery: di });
    }
    return t;
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

        if (this.grid.isObstacle(u)) {
          continue; // skip drawing edges for obstacle
        }

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


  private drawPD() {
    if (!this.two || !this.grid) return;
    this.pickupLayer.remove(this.pickupLayer.children);
    this.deliveryLayer.remove(this.deliveryLayer.children);
    for (const u of this.pickups) {
      const p = this.grid!.pos(u);
      const c = this.two!.makeCircle(p.x * this.s, p.y * this.s, 10);
      c.fill = "#2ecc71";
      c.stroke = "none";
      this.pickupLayer.add(c);
    }
    for (const u of this.deliveries) {
      const p = this.grid!.pos(u);
      const c = this.two!.makeCircle(p.x * this.s, p.y * this.s, 10);
      c.fill = "#e74c3c";
      c.stroke = "none";
      this.deliveryLayer.add(c);
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
    if (!this.two || !this.grid || !this.pibt) return;
    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(0.05, dt);

    for (const a of this.agents) a.step(dt, this.speedMultiplier);

    for (const a of this.agents) {
      if (a.state === "contracted") {
        if (a.mode === "to_pickup" && a.taskId != null) {
          const t = this.tasks.find(t => t.id === a.taskId)!;
          if (a.current === t.pickup) {
            t.picked = true;
            a.mode = "carrying";
          }
        } else if (a.mode === "carrying" && a.taskId != null) {
          const t = this.tasks.find(t => t.id === a.taskId)!;
          if (a.current === t.delivery) {
            t.done = true;
            t.assignedTo = null;
            a.mode = "free";
            a.taskId = null;
          }
        }
        if (a.mode === "free") {
          const avail = this.tasks.filter(t => !t.done && !t.assignedTo);
          if (avail.length > 0) {
            avail.sort((x, y) => manhattan(this.grid!.pos(x.pickup), this.grid!.pos(a.current)) - manhattan(this.grid!.pos(y.pickup), this.grid!.pos(a.current)));
            const t = avail[0];
            t.assignedTo = a.id;
            a.mode = "to_pickup";
            a.taskId = t.id;
          }
        }
      }
    }

    if (this.allContracted()) {
      const Q_from = this.agents.map(a => a.current);
      const pr = this.agents.map(a => this.priorityOf(a));
      const dist = (i: number, node: number) => {
        const ag = this.agents[i];
        if (ag.mode === "carrying" && ag.taskId != null) {
          const t = this.tasks.find(t => t.id === ag.taskId)!;
          return manhattan(this.grid!.pos(node), this.grid!.pos(t.delivery));
        }
        if (ag.mode === "to_pickup" && ag.taskId != null) {
          const t = this.tasks.find(t => t.id === ag.taskId)!;
          return manhattan(this.grid!.pos(node), this.grid!.pos(t.pickup));
        }
        return manhattan(this.grid!.pos(node), this.grid!.pos(ag.current));
      };
      const Q_to = this.pibt.step(Q_from, pr, dist);
      for (let i = 0; i < this.agents.length; i++) {
        const nextPos = Q_to[i];
        if (nextPos !== Q_from[i]) {
          this.agents[i].next = nextPos;
          this.agents[i].state = "extended";
        }
      }
    }

    this.pathLayer.remove(this.pathLayer.children);
    for (const a of this.agents) {
      if (a.state === "extended" && a.next != null) {
        const pu = this.grid!.pos(a.current);
        const pv = this.grid!.pos(a.next);
        const line = this.two.makeLine(pu.x * this.s, pu.y * this.s, pv.x * this.s, pv.y * this.s);
        line.stroke = a.color;
        line.linewidth = 3;
        this.pathLayer.add(line);
      }
      const gnode = this.goalNodeOf(a);
      if (gnode != null) {
        const gp = this.grid!.pos(gnode);
        const goalCircle = this.two.makeCircle(gp.x * this.s, gp.y * this.s, 8);
        goalCircle.fill = "transparent";
        goalCircle.stroke = a.color;
        goalCircle.linewidth = 2;
        this.pathLayer.add(goalCircle);
      }
    }
    for (const a of this.agents) a.draw(this.s);
  }

  private goalNodeOf(a: Agent) {
    if (a.mode === "carrying" && a.taskId != null) {
      return this.tasks.find(t => t.id === a.taskId)!.delivery;
    }
    if (a.mode === "to_pickup" && a.taskId != null) {
      return this.tasks.find(t => t.id === a.taskId)!.pickup;
    }
    return null;
  }

  private priorityOf(a: Agent) {
    const tier = a.mode === "carrying" ? 3 : a.mode === "to_pickup" ? 2 : 1;
    const gnode = this.goalNodeOf(a);
    const eta = gnode != null ? manhattan(this.grid!.pos(a.current), this.grid!.pos(gnode)) : 0;
    return tier * 1000 - eta * 10 - a.id;
  }

  private allContracted() {
    return this.agents.every((a) => a.state === "contracted");
  }

  destroy() {
    this.unbindUpdate?.();
    this.unbindUpdate = null;
    this.two?.clear();
    this.two?.pause();
    this.two = null;
    this.agents = [];
    this.grid = null;
    this.pibt = null;
    this.world = null;
    this.gridLayer = null;
    this.nodeLayer = null;
    this.pathLayer = null;
    this.agentLayer = null;
    this.pickupLayer = null;
    this.deliveryLayer = null;
    this.tasks = [];
  }
}
