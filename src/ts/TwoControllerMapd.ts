// src/ts/TwoControllerMapd.ts
import Two from "two.js";
import { drawRobot } from "./draw";
import { MapdGame, Agent } from "./game";

export class TwoControllerMapd {
  private two: Two | null = null;
  private world: any = null;
  private gridLayer: any = null;
  private nodeLayer: any = null;
  private pathLayer: any = null;
  private agentLayer: any = null;
  private pickupLayer: any = null;
  private deliveryLayer: any = null;
  private lastTime = 0;
  private unbindUpdate: (() => void) | null = null;
  private s = 100;

  private game: MapdGame | null = null;
  private agentGraphics = new Map<number, any>();

  mount(host: HTMLElement) {
    this.destroy();
    this.two = new Two({ type: Two.Types.svg, fitted: true, autostart: true }).appendTo(host);

    this.game = new MapdGame();

    this.world = this.two.makeGroup();
    this.gridLayer = this.two.makeGroup();
    this.nodeLayer = this.two.makeGroup();
    this.pickupLayer = this.two.makeGroup();
    this.deliveryLayer = this.two.makeGroup();
    this.pathLayer = this.two.makeGroup();
    this.agentLayer = this.two.makeGroup();
    this.world.add(this.gridLayer, this.nodeLayer, this.pickupLayer, this.deliveryLayer, this.pathLayer, this.agentLayer);

    this.drawGrid();
    this.drawPD();
    this.initAgents();
    this.layout();

    this.lastTime = performance.now();
    const onUpdate = () => this.update();
    this.two.bind("update", onUpdate);
    this.unbindUpdate = () => this.two?.unbind("update", onUpdate);
  }

  private drawGrid() {
    if (!this.two || !this.game) return;
    const grid = this.game.getGrid();
    this.gridLayer.remove(this.gridLayer.children);
    this.nodeLayer.remove(this.nodeLayer.children);
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        const u = grid.id(x, y);
        const pu = grid.pos(u);
        const ppx = pu.x * this.s, ppy = pu.y * this.s;
        if (grid.isObstacle(u)) continue;
        const dot = this.two.makeCircle(ppx, ppy, 4);
        dot.fill = "#777";
        dot.stroke = "transparent";
        this.nodeLayer.add(dot);
        const ns = grid.neighbors(u);
        for (const v of ns) {
          const pv = grid.pos(v);
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
    if (!this.two || !this.game) return;
    const grid = this.game.getGrid();
    this.pickupLayer.remove(this.pickupLayer.children);
    this.deliveryLayer.remove(this.deliveryLayer.children);
    for (const u of this.game.getPickups()) {
      const p = grid.pos(u);
      const c = this.two.makeCircle(p.x * this.s, p.y * this.s, 10);
      c.fill = "#2ecc71";
      c.stroke = "none";
      this.pickupLayer.add(c);
    }
    for (const u of this.game.getDeliveries()) {
      const p = grid.pos(u);
      const c = this.two.makeCircle(p.x * this.s, p.y * this.s, 10);
      c.fill = "#e74c3c";
      c.stroke = "none";
      this.deliveryLayer.add(c);
    }
  }

  private initAgents() {
    if (!this.two || !this.game) return;
    this.agentLayer.remove(this.agentLayer.children);
    this.agentGraphics.clear();
    for (const a of this.game.getAgents()) {
      const g = drawRobot(this.two, a.pos.x * this.s, a.pos.y * this.s, 60, a.color, String(a.id));
      this.agentGraphics.set(a.id, g);
      this.agentLayer.add(g);
    }
  }

  private layout() {
    if (!this.two || !this.game) return;
    const grid = this.game.getGrid();
    const gw = (grid.w - 1) * this.s;
    const gh = (grid.h - 1) * this.s;
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
    if (!this.two || !this.game) return;
    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(0.05, dt);

    this.game.update(dt);

    const grid = this.game.getGrid();
    const agents = this.game.getAgents();

    this.pathLayer.remove(this.pathLayer.children);
    for (const a of agents) {
      if (a.state === "extended" && a.next != null) {
        const pu = grid.pos(a.current);
        const pv = grid.pos(a.next);
        const line = this.two.makeLine(pu.x * this.s, pu.y * this.s, pv.x * this.s, pv.y * this.s);
        line.stroke = a.color;
        line.linewidth = 3;
        this.pathLayer.add(line);
      }
      const gnode = this.game.getAgentGoalNode(a);
      if (gnode != null) {
        const gp = grid.pos(gnode);
        const goalCircle = this.two.makeCircle(gp.x * this.s, gp.y * this.s, 8);
        goalCircle.fill = "transparent";
        goalCircle.stroke = a.color;
        goalCircle.linewidth = 2;
        this.pathLayer.add(goalCircle);
      }
    }

    for (const a of agents) this.drawAgent(a);
  }

  private drawAgent(a: Agent) {
    const g = this.agentGraphics.get(a.id);
    if (!g) return;
    g.translation.set(a.pos.x * this.s, a.pos.y * this.s);
    g.rotation = a.heading;
  }

  destroy() {
    this.unbindUpdate?.();
    this.unbindUpdate = null;
    this.two?.clear();
    this.two?.pause();
    this.two = null;
    this.world = null;
    this.gridLayer = null;
    this.nodeLayer = null;
    this.pathLayer = null;
    this.agentLayer = null;
    this.pickupLayer = null;
    this.deliveryLayer = null;
    this.agentGraphics.clear();
    this.game = null;
  }
}
