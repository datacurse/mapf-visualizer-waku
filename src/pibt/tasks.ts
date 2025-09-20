// tasks.ts
import { Node, PickupNode, DeliveryNode } from "./world";
import { Robot } from "./robot";

export enum TaskStatus {
  Pending = "pending",
  ToPickup = "to_pickup",
  Carrying = "carrying",
  Done = "done",
}

export type Task = {
  id: number;
  pickup: PickupNode;
  delivery: DeliveryNode;
  status: TaskStatus;
  robotId?: number;
};

export class TaskManager {
  private seq = 1;
  private tasks = new Map<number, Task>();

  addTask(pickup: PickupNode, delivery: DeliveryNode) {
    const t: Task = { id: this.seq++, pickup, delivery, status: TaskStatus.Pending };
    this.tasks.set(t.id, t);
    return t;
  }

  list(filter?: (t: Task) => boolean) {
    const all = Array.from(this.tasks.values());
    return filter ? all.filter(filter) : all;
  }

  nextFor(robot: Robot) {
    const pending = this.list(t => t.status === TaskStatus.Pending && t.robotId === undefined);
    if (pending.length === 0) return null;
    pending.sort((a, b) => manhattan(robot.node, a.pickup) - manhattan(robot.node, b.pickup));
    const chosen = pending[0];
    chosen.robotId = robot.id;
    chosen.status = TaskStatus.ToPickup;
    return chosen;
  }

  onArrivePickup(robot: Robot) {
    const t = this.byRobot(robot.id);
    if (!t) return null;
    if (t.status !== TaskStatus.ToPickup) return t;
    t.status = TaskStatus.Carrying;
    return t;
  }

  onArriveDelivery(robot: Robot) {
    const t = this.byRobot(robot.id);
    if (!t) return null;
    if (t.status !== TaskStatus.Carrying) return t;
    t.status = TaskStatus.Done;
    return t;
  }

  byRobot(robotId: number) {
    for (const t of this.tasks.values()) if (t.robotId === robotId && t.status !== TaskStatus.Done) return t;
    return null;
  }

  get(id: number) {
    return this.tasks.get(id) ?? null;
  }
}

function manhattan(a: Node, b: Node) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
