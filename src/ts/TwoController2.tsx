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
}

class DistTable {
  grid: Grid;
  goal: number;
  table: number[];

  constructor(grid: Grid, goal: number) {
    this.grid = grid;
    this.goal = goal;
    this.table = new Array(grid.w * grid.h).fill(grid.w * grid.h);
    this.table[goal] = 0;
    const queue = [goal];
    while (queue.length) {
      const u = queue.shift()!;
      const d = this.table[u];
      for (const v of grid.neighbors(u)) {
        if (d + 1 < this.table[v]) {
          this.table[v] = d + 1;
          queue.push(v);
        }
      }
    }
  }

  get(target: number): number {
    return this.table[target];
  }
}

class PIBT {
  grid: Grid;
  starts: number[];
  goals: number[];
  N: number;
  dist_tables: DistTable[];
  NIL: number;
  NIL_COORD: number;
  occupied_now: number[];
  occupied_nxt: number[];

  constructor(grid: Grid, starts: number[], goals: number[]) {
    this.grid = grid;
    this.starts = starts;
    this.goals = goals;
    this.N = starts.length;
    this.dist_tables = goals.map((g) => new DistTable(grid, g));
    this.NIL = this.N;
    this.NIL_COORD = -1;
    this.occupied_now = [];
    this.occupied_nxt = [];
  }

  funcPIBT(Q_from: number[], Q_to: number[], i: number): boolean {
    let C = [Q_from[i], ...this.grid.neighbors(Q_from[i])];
    shuffle(C);
    C.sort((a, b) => this.dist_tables[i].get(a) - this.dist_tables[i].get(b));
    for (const v of C) {
      if (this.occupied_nxt[v] !== this.NIL) continue;
      const j = this.occupied_now[v];
      if (j !== this.NIL && Q_to[j] === Q_from[i]) continue;
      Q_to[i] = v;
      this.occupied_nxt[v] = i;
      if (j !== this.NIL && Q_to[j] === this.NIL_COORD && !this.funcPIBT(Q_from, Q_to, j)) {
        continue;
      }
      return true;
    }
    Q_to[i] = Q_from[i];
    this.occupied_nxt[Q_from[i]] = i;
    return false;
  }

  step(Q_from: number[], priorities: number[]): number[] {
    const N = Q_from.length;
    const Q_to: number[] = new Array(N).fill(this.NIL_COORD);
    this.occupied_now = new Array(this.grid.w * this.grid.h).fill(this.NIL);
    for (let i = 0; i < N; i++) {
      this.occupied_now[Q_from[i]] = i;
    }
    this.occupied_nxt = new Array(this.grid.w * this.grid.h).fill(this.NIL);
    const A = Array.from({ length: N }, (_, k) => k).sort((a, b) => priorities[b] - priorities[a]);
    for (const i of A) {
      if (Q_to[i] === this.NIL_COORD) {
        this.funcPIBT(Q_from, Q_to, i);
      }
    }
    return Q_to;
  }
}

class Agent {
  id: number;
  grid: Grid;
  current: number;
  next: number | null;
  goal: number;
  pos: { x: number; y: number };
  heading: number;
  v: number;
  kin: { vmax: number; a: number; d: number; rotRate: number; nodeRadius: number; headingTol: number };
  state: "contracted" | "extended";
  g: any;
  size = 60;
  color: string;

  constructor(id: number, grid: Grid, current: number, goal: number, kin: any, color: string, two: Two) {
    this.id = id;
    this.grid = grid;
    this.current = current;
    this.next = null;
    this.goal = goal;
    this.pos = this.grid.pos(this.current);
    this.heading = 0;
    this.v = 0;
    this.kin = kin;
    this.state = "contracted";
    this.color = color;
    this.g = drawRobot(two, this.pos.x * 100, this.pos.y * 100, this.size, color, String(id));
  }
  done() {
    return this.current === this.goal && this.state === "contracted";
  }
  step(dt: number, multiplier: number) {
    if (this.state === "contracted") {
      return;
    }
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

export class TwoController2 {
  private two: Two | null = null;
  private agents: Agent[] = [];
  private grid: Grid | null = null;
  private pibt: PIBT | null = null;
  private priorities: number[] = [];
  private world: any = null;
  private gridLayer: any = null;
  private nodeLayer: any = null;
  private pathLayer: any = null;
  private agentLayer: any = null;
  private lastTime: number = 0;
  private unbindUpdate: (() => void) | null = null;
  private s: number = 100;
  private speedMultiplier: number = 10;
  private numAgents: number;
  private replanRequested = false;
  private finishers = new Set<number>();

  private colors: string[] = [
    "#FF5A5A", "#4A90E2", "#50E3C2", "#F5A623", "#7B1FA2",
    "#C2185B", "#009688", "#8BC34A", "#FFC107", "#795548",
    "#9E9E9E", "#607D8B", "#E91E63", "#3F51B5", "#00BCD4",
    "#CDDC39", "#FF9800", "#673AB7", "#2196F3", "#4CAF50"
  ];

  constructor(numAgents: number = 4) {
    this.numAgents = numAgents;
  }

  mount(host: HTMLElement) {
    this.destroy();
    this.two = new Two({ type: Two.Types.svg, fitted: true, autostart: true }).appendTo(host);

    const two = this.two!;
    this.grid = new Grid(7, 7);

    const baseKin = {
      vmax: 1.6,
      a: 1.2,
      d: 1.8,
      rotRate: Math.PI,
      nodeRadius: 0.001,
      headingTol: 0.03,
    };

    const allIds = Array.from({ length: this.grid.w * this.grid.h }, (_, i) => i);
    const shuffled = shuffle(allIds);
    const starts = shuffled.slice(0, this.numAgents);
    const goals = shuffled.slice(this.numAgents, this.numAgents * 2);

    this.pibt = new PIBT(this.grid, starts, goals);
    this.priorities = starts.map((s, i) => this.pibt.dist_tables[i].get(s) / (this.grid.w * this.grid.h));

    this.agents = [];
    for (let i = 0; i < this.numAgents; i++) {
      const kin = { ...baseKin };
      const color = this.colors[i % this.colors.length];
      const a = new Agent(i, this.grid, starts[i], goals[i], kin, color, two);
      this.agents.push(a);
    }

    this.world = this.two.makeGroup();
    this.gridLayer = this.two.makeGroup();
    this.nodeLayer = this.two.makeGroup();
    this.pathLayer = this.two.makeGroup();
    this.agentLayer = this.two.makeGroup();
    this.world.add(this.gridLayer, this.nodeLayer, this.pathLayer, this.agentLayer);
    this.agents.forEach((a) => this.agentLayer.add(a.g));

    this.drawGrid();
    this.layout();

    this.lastTime = performance.now();
    const onUpdate = () => this.update();
    this.two.bind("update", onUpdate);
    this.unbindUpdate = () => this.two?.unbind("update", onUpdate);
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
    if (!this.two || !this.grid || !this.pibt) return;
    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(0.05, dt);

    for (const a of this.agents) a.step(dt, this.speedMultiplier);

    for (const a of this.agents) {
      if (a.done() && !this.finishers.has(a.id)) {
        const newGoal = this.pickNewGoal(a.id);
        if (newGoal !== null) {
          a.goal = newGoal;
          this.replanRequested = true;
          this.finishers.add(a.id);
        }
      }
    }

    if (this.replanRequested && this.allContracted()) {
      this.performReplan();
    }

    if (this.allContracted()) {
      const Q_from = this.agents.map((a) => a.current);
      const Q_to = this.pibt.step(Q_from, this.priorities);
      for (let i = 0; i < this.numAgents; i++) {
        let nextPos = Q_to[i];
        if (nextPos !== Q_from[i]) {
          this.agents[i].next = nextPos;
          this.agents[i].state = "extended";
        }
      }
      let flg_fin = true;
      for (let i = 0; i < this.numAgents; i++) {
        const q = Q_to[i];
        if (q !== this.agents[i].goal) {
          flg_fin = false;
          this.priorities[i] += 1;
        } else {
          this.priorities[i] -= Math.floor(this.priorities[i]);
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
      const goalPos = this.grid!.pos(a.goal);
      const goalCircle = this.two.makeCircle(goalPos.x * this.s, goalPos.y * this.s, 8);
      goalCircle.fill = "transparent";
      goalCircle.stroke = a.color;
      goalCircle.linewidth = 2;
      this.pathLayer.add(goalCircle);
    }
    for (const a of this.agents) a.draw(this.s);
  }

  private allContracted() {
    return this.agents.every((a) => a.state === "contracted");
  }

  private pickNewGoal(agentId: number): number | null {
    const occupied = new Set(this.agents.map((a) => a.current));
    const otherGoals = new Set(this.agents.filter((a) => a.id !== agentId).map((a) => a.goal));
    const allIds = Array.from({ length: this.grid!.w * this.grid!.h }, (_, i) => i);
    const candidates = allIds.filter((id) => !occupied.has(id) && !otherGoals.has(id));
    if (candidates.length === 0) return allIds.find((id) => !occupied.has(id)) ?? null;
    shuffle(candidates);
    return candidates[0];
  }

  private performReplan() {
    const starts = this.agents.map((a) => a.current);
    const goals = this.agents.map((a) => a.goal);
    this.pibt = new PIBT(this.grid!, starts, goals);
    this.priorities = this.agents.map((a, i) => this.pibt.dist_tables[i].get(starts[i]) / (this.grid!.w * this.grid!.h));
    this.replanRequested = false;
    this.finishers.clear();
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
    this.priorities = [];
    this.world = null;
    this.gridLayer = null;
    this.nodeLayer = null;
    this.pathLayer = null;
    this.agentLayer = null;
    this.replanRequested = false;
    this.finishers.clear();
  }
}