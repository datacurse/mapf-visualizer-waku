// world.ts
export class Node {
  readonly x: number;
  readonly y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

export class PickupNode extends Node { }

export class DeliveryNode extends Node {
  readonly items: unknown[] = [];
}

export class World {
  readonly width: number;
  readonly height: number;
  private obstacles: Node[];
  private pickups: PickupNode[];
  private deliveries: DeliveryNode[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.obstacles = [];
    this.pickups = [];
    this.deliveries = [];
  }

  static index(x: number, y: number, width: number) {
    return y * width + x;
  }

  static pos(index: number, width: number): Node {
    const x = index % width;
    const y = (index - x) / width;
    return new Node(x, y);
  }

  inBounds(n: Node) {
    return n.x >= 0 && n.y >= 0 && n.x < this.width && n.y < this.height;
  }

  isObstacleAtNode(n: Node) {
    if (!this.inBounds(n)) return true;
    return this.obstacles.some(o => o.x === n.x && o.y === n.y);
  }

  getNodeNeighbors(n: Node): Node[] {
    const candidates: Node[] = [
      new Node(n.x + 1, n.y),
      new Node(n.x - 1, n.y),
      new Node(n.x, n.y + 1),
      new Node(n.x, n.y - 1),
    ];
    return candidates.filter(
      q => this.inBounds(q) && !this.isObstacleAtNode(q)
    );
  }
}
