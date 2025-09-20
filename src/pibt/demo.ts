// pibt_mapd_demo.ts
import { PIBT_MAPD } from "./pibt";

type Vec = { x: number; y: number };

function k(v: Vec) {
  return `${v.x},${v.y}`;
}

function mkGrid(width: number, height: number) {
  return { width, height, blocked: new Set<string>() };
}

function mkAgents(n: number, pickups: Vec[]) {
  const agents = [];
  for (let i = 0; i < n; i++) {
    const p = pickups[i % pickups.length];
    agents.push({ id: i, pos: { x: p.x, y: p.y }, mode: PIBT_MAPD.Mode.Free as const });
  }
  return agents;
}

function mkTasks(count: number, pickups: Vec[], deliveries: Vec[]) {
  const tasks = [];
  let id = 1;
  for (let i = 0; i < count; i++) {
    const pu = pickups[i % pickups.length];
    const di = deliveries[i % deliveries.length];
    tasks.push({ id: id++, pickup: { x: pu.x, y: pu.y }, delivery: { x: di.x, y: di.y } });
  }
  return tasks;
}

function printState(step: number, grid: { width: number; height: number }, agents: any[], tasks: any[], pickups: Vec[], deliveries: Vec[]) {
  const aMap = new Map<string, number>();
  for (const a of agents) aMap.set(k(a.pos), a.id);
  const pSet = new Set(pickups.map(k));
  const dSet = new Set(deliveries.map(k));
  const done = tasks.filter(t => t.done).length;
  const carrying = tasks.filter(t => t.picked && !t.done).length;
  const pending = tasks.length - done - carrying;

  console.log(`step ${step} | pending ${pending} | carrying ${carrying} | done ${done}`);
  for (let y = 0; y < grid.height; y++) {
    let row = "";
    for (let x = 0; x < grid.width; x++) {
      const key = `${x},${y}`;
      if (aMap.has(key)) row += String(aMap.get(key)!).slice(-1);
      else if (pSet.has(key)) row += "P";
      else if (dSet.has(key)) row += "D";
      else row += ".";
    }
    console.log(row);
  }
  console.log("");
}

async function main() {
  const width = 4;
  const height = 4;
  const grid = mkGrid(width, height);

  const pickups = Array.from({ length: width }, (_, x) => ({ x, y: height - 1 }));
  const deliveries = Array.from({ length: width }, (_, x) => ({ x, y: 0 }));

  let agents = mkAgents(3, pickups);
  let tasks = mkTasks(20, pickups, deliveries);

  printState(0, grid, agents, tasks, pickups, deliveries);

  for (let step = 1; step <= 200; step++) {
    const next = PIBT_MAPD.step(grid, agents, tasks);
    agents = next.agents;
    tasks = next.tasks;

    for (const a of agents) {
      if (a.mode === PIBT_MAPD.Mode.Free) {
        const available = tasks.filter(t => !t.done && !t.assignedTo);
        if (available.length > 0) {
          available.sort((x, y) => Math.abs(a.pos.x - x.pickup.x) + Math.abs(a.pos.y - x.pickup.y) - (Math.abs(a.pos.x - y.pickup.x) + Math.abs(a.pos.y - y.pickup.y)));
          const t = available[0];
          t.assignedTo = a.id;
          a.mode = PIBT_MAPD.Mode.ToPickup;
          a.taskId = t.id;
        }
      }
    }

    printState(step, grid, agents, tasks, pickups, deliveries);

    if (tasks.every(t => t.done)) break;
  }
}

main();
