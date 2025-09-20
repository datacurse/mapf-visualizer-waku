type Vec = { x: number; y: number };

type Grid = {
  width: number;
  height: number;
  blocked: Set<string>;
};

type Task = {
  id: number;
  pickup: Vec;
  delivery: Vec;
  assignedTo?: number | null;
  picked?: boolean;
  done?: boolean;
};

enum Mode {
  Free = "free",
  ToPickup = "to_pickup",
  Carrying = "carrying",
}

type Agent = {
  id: number;
  pos: Vec;
  mode: Mode;
  taskId?: number | null;
};

type NextPlan = Map<number, string>;

function k(v: Vec) {
  return `${v.x},${v.y}`;
}

function v(s: string): Vec {
  const [x, y] = s.split(",").map(Number);
  return { x, y };
}

function inb(g: Grid, p: Vec) {
  return p.x >= 0 && p.y >= 0 && p.x < g.width && p.y < g.height;
}

function walkable(g: Grid, p: Vec) {
  return inb(g, p) && !g.blocked.has(k(p));
}

function manhattan(a: Vec, b: Vec) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function neigh(g: Grid, p: Vec) {
  const c = [
    { x: p.x + 1, y: p.y },
    { x: p.x - 1, y: p.y },
    { x: p.x, y: p.y + 1 },
    { x: p.x, y: p.y - 1 },
  ].filter((q) => walkable(g, q));
  c.push(p);
  return c;
}

function targetOf(a: Agent, tasks: Map<number, Task>) {
  if (a.mode === Mode.Carrying && a.taskId != null) return tasks.get(a.taskId!)!.delivery;
  if (a.mode === Mode.ToPickup && a.taskId != null) return tasks.get(a.taskId!)!.pickup;
  return a.pos;
}

function priority(a: Agent, tasks: Map<number, Task>) {
  const tier = a.mode === Mode.Carrying ? 3 : a.mode === Mode.ToPickup ? 2 : 1;
  const t = targetOf(a, tasks);
  const eta = manhattan(a.pos, t);
  return { tier, eta, id: a.id };
}

function cmpAgents(a: Agent, b: Agent, tasks: Map<number, Task>) {
  const pa = priority(a, tasks);
  const pb = priority(b, tasks);
  if (pa.tier !== pb.tier) return pb.tier - pa.tier;
  if (pa.eta !== pb.eta) return pa.eta - pb.eta;
  return pa.id - pb.id;
}

function chooseOrder(g: Grid, cur: Vec, goal: Vec) {
  return neigh(g, cur).sort((p, q) => manhattan(p, goal) - manhattan(q, goal));
}

function swap(a: string, b: string, plan: NextPlan, curPos: Map<number, string>) {
  for (const [id, to] of plan) {
    const from = curPos.get(id)!;
    if ((from === a && to === b) || (from === b && to === a)) return true;
  }
  return false;
}

function occupantAt(posKey: string, curPos: Map<number, string>) {
  for (const [id, s] of curPos) if (s === posKey) return id;
  return null;
}

function pibt(
  aid: number,
  caller: number | null,
  agents: Map<number, Agent>,
  tasks: Map<number, Task>,
  g: Grid,
  curPos: Map<number, string>,
  plan: NextPlan,
  visiting: Set<number>
): boolean {
  if (visiting.has(aid)) return false;
  visiting.add(aid);
  const a = agents.get(aid)!;
  const goal = targetOf(a, tasks);
  const cand = chooseOrder(g, a.pos, goal);
  for (const c of cand) {
    const toKey = k(c);
    if ([...plan.values()].includes(toKey)) continue;
    if (swap(k(a.pos), toKey, plan, curPos)) continue;
    const occ = occupantAt(toKey, curPos);
    if (occ == null || plan.has(occ)) {
      plan.set(aid, toKey);
      visiting.delete(aid);
      return true;
    }
    const o = agents.get(occ)!;
    const pa = priority(a, tasks);
    const po = priority(o, tasks);
    if (pa.tier > po.tier || (pa.tier === po.tier && (pa.eta < po.eta || (pa.eta === po.eta && pa.id < po.id)))) {
      if (pibt(occ, aid, agents, tasks, g, curPos, plan, visiting)) {
        plan.set(aid, toKey);
        visiting.delete(aid);
        return true;
      }
    }
  }
  visiting.delete(aid);
  return false;
}

function step(g: Grid, agentsArr: Agent[], tasksArr: Task[]) {
  const agents = new Map(agentsArr.map((a) => [a.id, a]));
  const tasks = new Map(tasksArr.map((t) => [t.id, t]));
  for (const a of agents.values()) {
    if (a.mode === Mode.Free) {
      const cand = tasksArr.filter((t) => !t.done && !t.assignedTo);
      if (cand.length > 0) {
        cand.sort((x, y) => manhattan(a.pos, x.pickup) - manhattan(a.pos, y.pickup));
        const t = cand[0];
        t.assignedTo = a.id;
        a.mode = Mode.ToPickup;
        a.taskId = t.id;
      }
    }
  }
  const curPos = new Map<number, string>();
  for (const a of agents.values()) curPos.set(a.id, k(a.pos));
  const order = [...agents.values()].sort((x, y) => cmpAgents(x, y, tasks));
  const plan: NextPlan = new Map();
  for (const a of order) pibt(a.id, null, agents, tasks, g, curPos, plan, new Set());
  for (const a of order) {
    const toKey = plan.get(a.id) ?? k(a.pos);
    const next = v(toKey);
    a.pos = next;
  }
  for (const a of agents.values()) {
    if (a.mode === Mode.ToPickup && a.taskId != null) {
      const t = tasks.get(a.taskId)!;
      if (a.pos.x === t.pickup.x && a.pos.y === t.pickup.y) {
        t.picked = true;
        a.mode = Mode.Carrying;
      }
    } else if (a.mode === Mode.Carrying && a.taskId != null) {
      const t = tasks.get(a.taskId)!;
      if (a.pos.x === t.delivery.x && a.pos.y === t.delivery.y) {
        t.done = true;
        t.assignedTo = null;
        a.mode = Mode.Free;
        a.taskId = null;
      }
    }
  }
  return {
    agents: agentsArr.map((x) => agents.get(x.id)!),
    tasks: tasksArr.map((x) => tasks.get(x.id)!),
  };
}

export const PIBT_MAPD = {
  step,
  Mode,
};
