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
      current = parent.get(current) ?? null;
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
    const k = this.key(u, v), kr = this.key(v, u);
    const eo = this.edgeOwner.get(k), eor = this.edgeOwner.get(kr);
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

interface Fragment {
  agents: number[];
  indexes: number[];
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
  size = 60;
  color: string;
  goal: number;

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
    this.color = color;
    this.goal = path[path.length - 1];
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
  step(dt: number, multiplier: number) {
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
    this.res = new Reservations();

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

    let paths = null;
    let attempts = 0;
    const maxAttempts = 100;
    while (!paths && attempts < maxAttempts) {
      paths = this.computePaths(starts, goals);
      attempts++;
    }
    this.agents = [];
    if (paths) {
      for (let i = 0; i < this.numAgents; i++) {
        const kin = { ...baseKin };
        const color = this.colors[i % this.colors.length];
        const a = new Agent(i, this.grid, this.res, paths[i], kin, color, two);
        a.goal = goals[i];
        this.agents.push(a);
      }
    } else {
      console.error("Failed to find paths after max attempts");
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

  private computePaths(starts: number[], goals: number[], orderOverride?: number[]): number[][] | null {
    const agentCount = starts.length;
    const order = orderOverride ? [...orderOverride] : shuffle(Array.from({ length: agentCount }, (_, i) => i));
    const paths: (number[] | undefined)[] = new Array(agentCount);
    const thetaS = new Map<number, Fragment[]>();
    const thetaT = new Map<number, Fragment[]>();
    for (const idx of order) {
      const forbiddenVerts = new Set<number>();
      for (let k = 0; k < agentCount; k++) {
        if (k !== idx && starts[idx] !== goals[k]) forbiddenVerts.add(goals[k]);
      }
      const forbiddenEdges = new Set<string>();
      for (const [u, fragments] of thetaT.entries()) {
        for (const theta of fragments || []) {
          const firstA = theta.agents[0];
          const firstI = theta.indexes[0];
          const v = paths[firstA]![firstI];
          forbiddenEdges.add(`${u}->${v}`);
        }
      }
      const path = this.findConstrainedPath(starts[idx], goals[idx], forbiddenVerts, forbiddenEdges);
      if (!path) return null;
      paths[idx] = path;
      if (!this.addPathToFragments(thetaS, thetaT, idx, path, paths as number[][])) {
        return null;
      }
    }
    return paths as number[][];
  }

  private findConstrainedPath(start: number, goal: number, forbiddenVerts: Set<number>, forbiddenEdges: Set<string>): number[] | null {
    if (!this.grid) return null;
    const queue: number[] = [start];
    const visited = new Set([start]);
    const parent = new Map<number, number>();
    parent.set(start, -1);
    let found = false;
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === goal) {
        found = true;
        break;
      }
      for (const neigh of this.grid.neighbors(curr)) {
        if (visited.has(neigh)) continue;
        if (forbiddenVerts.has(neigh) && neigh !== goal) continue;
        const edgeKey = `${curr}->${neigh}`;
        if (forbiddenEdges.has(edgeKey)) continue;
        visited.add(neigh);
        parent.set(neigh, curr);
        queue.push(neigh);
      }
    }
    if (!found) return null;
    const path: number[] = [];
    let curr: number | undefined = goal;
    while (curr !== undefined && curr !== -1) {
      path.push(curr);
      curr = parent.get(curr);
    }
    path.reverse();
    return path;
  }

  private addPathToFragments(
    thetaS: Map<number, Fragment[]>,
    thetaT: Map<number, Fragment[]>,
    agentId: number,
    path: number[],
    allPaths: number[][]
  ): boolean {
    for (let jj = 0; jj < path.length - 1; jj++) {
      const u = path[jj];
      const v = path[jj + 1];
      const theta: Fragment = { agents: [agentId], indexes: [jj] };
      this.registerFragment(thetaS, thetaT, theta, allPaths);
      for (const thetat of thetaT.get(u) || []) {
        if (thetat.agents.includes(agentId)) continue;
        const newAgents = [...thetat.agents, agentId];
        const newIndexes = [...thetat.indexes, jj];
        const newTheta: Fragment = { agents: newAgents, indexes: newIndexes };
        if (this.isPotentialDeadlock(newTheta, allPaths)) return false;
        this.registerFragment(thetaS, thetaT, newTheta, allPaths);
      }
      for (const thetaf of thetaS.get(v) || []) {
        if (thetaf.agents.includes(agentId)) continue;
        const newAgents = [agentId, ...thetaf.agents];
        const newIndexes = [jj, ...thetaf.indexes];
        const newTheta: Fragment = { agents: newAgents, indexes: newIndexes };
        if (this.isPotentialDeadlock(newTheta, allPaths)) return false;
        this.registerFragment(thetaS, thetaT, newTheta, allPaths);
      }
      for (const thetat of thetaT.get(u) || []) {
        for (const thetaf of thetaS.get(v) || []) {
          if (thetat.agents.includes(agentId) || thetaf.agents.includes(agentId)) continue;
          if (thetat.agents.some((a) => thetaf.agents.includes(a))) continue;
          const newAgents = [...thetat.agents, agentId, ...thetaf.agents];
          const newIndexes = [...thetat.indexes, jj, ...thetaf.indexes];
          const newTheta: Fragment = { agents: newAgents, indexes: newIndexes };
          if (this.isPotentialDeadlock(newTheta, allPaths)) return false;
          this.registerFragment(thetaS, thetaT, newTheta, allPaths);
        }
      }
    }
    return true;
  }

  private registerFragment(
    thetaS: Map<number, Fragment[]>,
    thetaT: Map<number, Fragment[]>,
    theta: Fragment,
    allPaths: number[][]
  ) {
    const firstA = theta.agents[0];
    const firstI = theta.indexes[0];
    const start = allPaths[firstA][firstI];
    const lastA = theta.agents[theta.agents.length - 1];
    const lastI = theta.indexes[theta.indexes.length - 1];
    const end = allPaths[lastA][lastI + 1];
    if (!thetaS.has(start)) thetaS.set(start, []);
    thetaS.get(start)!.push(theta);
    if (!thetaT.has(end)) thetaT.set(end, []);
    thetaT.get(end)!.push(theta);
  }

  private isPotentialDeadlock(theta: Fragment, allPaths: number[][]): boolean {
    const firstA = theta.agents[0];
    const firstI = theta.indexes[0];
    const start = allPaths[firstA][firstI];
    const lastA = theta.agents[theta.agents.length - 1];
    const lastI = theta.indexes[theta.indexes.length - 1];
    const lastNext = allPaths[lastA][lastI + 1];
    return start === lastNext;
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
    if (!this.two || !this.grid) return;
    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(0.05, dt);

    const order = shuffle([...this.agents]);
    for (const a of order) a.step(dt, this.speedMultiplier);

    for (const a of this.agents) {
      if (a.done() && a.goal === a.from) {
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

    this.pathLayer.remove(this.pathLayer.children);
    for (const a of this.agents) {
      const remainingPath = a.path.slice(a.idx);
      if (remainingPath.length < 2) continue;
      for (let i = 0; i < remainingPath.length - 1; i++) {
        const u = remainingPath[i];
        const v = remainingPath[i + 1];
        const pu = this.grid!.pos(u);
        const pv = this.grid!.pos(v);
        const line = this.two.makeLine(pu.x * this.s, pu.y * this.s, pv.x * this.s, pv.y * this.s);
        line.stroke = a.color;
        line.linewidth = 3;
        this.pathLayer.add(line);
      }
      const goalId = a.goal;
      const goalPos = this.grid!.pos(goalId);
      const goalCircle = this.two.makeCircle(goalPos.x * this.s, goalPos.y * this.s, 8);
      goalCircle.fill = 'transparent';
      goalCircle.stroke = a.color;
      goalCircle.linewidth = 2;
      this.pathLayer.add(goalCircle);
    }
    for (const a of this.agents) a.draw(this.s);
  }

  private allContracted() {
    return this.agents.every(a => a.state === "contracted");
  }

  private pickNewGoal(agentId: number): number {
    const occupied = new Set(this.agents.map(a => a.from));
    const otherGoals = new Set(this.agents.filter(a => a.id !== agentId).map(a => a.goal));
    const allIds = Array.from({ length: this.grid!.w * this.grid!.h }, (_, i) => i);
    const candidates = allIds.filter(id => !occupied.has(id) && !otherGoals.has(id));
    if (candidates.length === 0) return allIds.find(id => !occupied.has(id)) ?? allIds[0];
    shuffle(candidates);
    return candidates[0];
  }

  private performReplan() {
    const starts = this.agents.map(a => a.from);
    const goals = this.agents.map(a => a.goal);
    const nonFinishers = this.agents.filter(a => !this.finishers.has(a.id)).map(a => a.id);
    const finisherIds = Array.from(this.finishers.values());
    const preferredOrder = [...nonFinishers, ...finisherIds];
    let newPaths = this.computePaths(starts, goals, preferredOrder);
    if (!newPaths) newPaths = this.computePaths(starts, goals);
    if (newPaths) {
      this.res = new Reservations();
      for (let i = 0; i < this.agents.length; i++) {
        const a = this.agents[i];
        a.path = newPaths[i];
        a.idx = 0;
        a.to = null;
        a.state = "contracted";
        a.v = 0;
        a.goal = goals[i];
        a.res = this.res;
        this.res.occupyVertex(a.id, a.from);
      }
      this.replanRequested = false;
      this.finishers.clear();
    }
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
    this.pathLayer = null;
    this.agentLayer = null;
    this.replanRequested = false;
    this.finishers.clear();
  }
}
