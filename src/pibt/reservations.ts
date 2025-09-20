// reservations.ts
import { Node } from "./world";
import { Robot } from "./robot";

export type Interval = { start: number; end: number };
export type CellReservation = { node: Node; interval: Interval; robotId: number };
export type EdgeReservation = { from: Node; to: Node; interval: Interval; robotId: number };

export class ReservationTable {
  private cells: CellReservation[] = [];
  private edges: EdgeReservation[] = [];

  reserveCell(node: Node, interval: Interval, robotId: number) {
    this.cells.push({ node, interval, robotId });
  }

  reserveEdge(from: Node, to: Node, interval: Interval, robotId: number) {
    this.edges.push({ from, to, interval, robotId });
  }

  freeOlderThan(time: number, robotId?: number) {
    this.cells = this.cells.filter(r => r.interval.end > time && (!robotId || r.robotId !== robotId));
    this.edges = this.edges.filter(r => r.interval.end > time && (!robotId || r.robotId !== robotId));
  }

  conflictCell(node: Node, interval: Interval, robotId: number) {
    return this.cells.some(r => sameNode(r.node, node) && overlap(r.interval, interval) && r.robotId !== robotId);
  }

  conflictEdge(from: Node, to: Node, interval: Interval, robotId: number) {
    return this.edges.some(r => opposite(r.from, r.to, from, to) && overlap(r.interval, interval) && r.robotId !== robotId);
  }
}

function overlap(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end;
}

function sameNode(a: Node, b: Node) {
  return a.x === b.x && a.y === b.y;
}

function opposite(a1: Node, a2: Node, b1: Node, b2: Node) {
  const sameDir = sameNode(a1, b1) && sameNode(a2, b2);
  const oppDir = sameNode(a1, b2) && sameNode(a2, b1);
  return sameDir || oppDir;
}
