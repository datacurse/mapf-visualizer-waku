// robot.ts
import { World, Node } from "./world";

export enum Orientation {
  Up = 0,
  Right = 1,
  Down = 2,
  Left = 3,
}

export enum Mode {
  Free = "free",
  ToPickup = "to_pickup",
  ToDeliver = "to_deliver",
  ToLounge = "to_lounge",
}

export enum PrimitiveKind {
  Forward = "forward",
  RotateL = "rotate_left",
  RotateR = "rotate_right",
  Wait = "wait",
}

export type Primitive = {
  kind: PrimitiveKind;
  from: Node;
  to: Node;
  startTheta: Orientation;
  endTheta: Orientation;
};

export type ActivePrimitive = Primitive & {
  startAt: number;
  finishAt: number;
};

export class Robot {
  readonly id: number;

  mode: Mode = Mode.Free;
  node: Node;
  theta: Orientation;

  taskPickup: Node | null = null;
  taskDelivery: Node | null = null;

  current: ActivePrimitive | null = null;

  constructor(id: number, start: Node, theta: Orientation) {
    this.id = id;
    this.node = start;
    this.theta = theta;
  }

  isIdle(now: number) {
    return !this.current || now >= this.current.finishAt;
  }

  begin(spec: Primitive, startAt: number, finishAt: number) {
    this.current = { ...spec, startAt, finishAt };
    return this.current;
  }

  finish(now: number) {
    if (!this.current) return;
    if (now < this.current.finishAt) return;
    this.node = this.current.to;
    this.theta = this.current.endTheta;
    this.current = null;
  }

  forwardSpec(world: World): Primitive | null {
    const d = Robot.dirVec(this.theta);
    const next = new Node(this.node.x + d.x, this.node.y + d.y);
    if (!world.inBounds(next) || world.isObstacleAtNode(next)) return null;
    return {
      kind: PrimitiveKind.Forward,
      from: this.node,
      to: next,
      startTheta: this.theta,
      endTheta: this.theta,
    };
  }

  rotateLeftSpec(): Primitive {
    const endTheta = Robot.wrapTheta((this.theta + 3) as Orientation);
    return {
      kind: PrimitiveKind.RotateL,
      from: this.node,
      to: this.node,
      startTheta: this.theta,
      endTheta,
    };
  }

  rotateRightSpec(): Primitive {
    const endTheta = Robot.wrapTheta((this.theta + 1) as Orientation);
    return {
      kind: PrimitiveKind.RotateR,
      from: this.node,
      to: this.node,
      startTheta: this.theta,
      endTheta,
    };
  }

  waitSpec(): Primitive {
    return {
      kind: PrimitiveKind.Wait,
      from: this.node,
      to: this.node,
      startTheta: this.theta,
      endTheta: this.theta,
    };
  }

  candidateSpecs(world: World): Primitive[] {
    const out: Primitive[] = [];
    const f = this.forwardSpec(world);
    if (f) out.push(f);
    out.push(this.rotateLeftSpec());
    out.push(this.rotateRightSpec());
    out.push(this.waitSpec());
    return out;
  }

  static dirVec(theta: Orientation) {
    if (theta === Orientation.Up) return { x: 0, y: -1 };
    if (theta === Orientation.Right) return { x: 1, y: 0 };
    if (theta === Orientation.Down) return { x: 0, y: 1 };
    return { x: -1, y: 0 };
  }

  static wrapTheta(t: Orientation) {
    return ((t % 4) + 4) % 4 as Orientation;
  }

  static turnsBetween(a: Orientation, b: Orientation) {
    const d = Math.abs(a - b) % 4;
    return Math.min(d, 4 - d);
  }

  static primaryHeading(a: Node, b: Node): Orientation {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? Orientation.Right : Orientation.Left;
    } else {
      return dy >= 0 ? Orientation.Down : Orientation.Up;
    }
  }
}
