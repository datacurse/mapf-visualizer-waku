// Two.js v0.8.17
import Two from 'two.js';
import { Group } from 'two.js/src/group';
import { Path } from 'two.js/src/path';
import { Line } from 'two.js/src/shapes/line';
import { Anchor } from 'two.js/src/anchor';
import { orientationToRotation, Orientation, Solution } from './Components/Solution';
import { drawMap } from './draw/drawMap';
import { ZoomPan } from './ZoomPan'; // NEW

const CELL_SIZE = 100;
const AGENT_COLORS = ['#E91E63', '#2196F3', '#4CAF50', '#FF9800', '#00BCD4', '#9C27B0', '#795548', '#FFBB3B', '#F44336', '#607D8B', '#009688', '#3F51B5'] as const;
const TEXT_COLOR = '#000';
const BACKGROUND_COLOR = '#FFF';
const FONT_SUPER_RESOLUTION_SCALE = 3;

type LayerName = 'map' | 'goals' | 'paths' | 'vectors' | 'agents';

export class MapClass {
  private two: Two | null = null;
  private root: Group | null = null;
  private host: HTMLElement | null = null;

  private layers!: Record<LayerName, Group>;
  private unbindUpdate: (() => void) | null = null;

  private solution: Solution | null = null;
  private timestep = 0;
  private playAnimation = true;
  private stepSize = 1.0; // steps per second
  private loopAnimation = true;
  private orientationAware = false;

  private zoomer: ZoomPan | null = null; // NEW

  mount(host: HTMLElement) {
    this.destroy();
    this.two = new Two({ type: Two.Types.svg, fitted: true, autostart: true }).appendTo(host);
    this.host = host;

    // optional: improve pointer behavior on touch/pen
    this.host.style.touchAction = 'none'; // NEW

    // Scene root (camera target)
    const root = new Group();
    this.two.add(root);
    this.root = root;

    // Stable layers (draw order = array order)
    this.layers = {
      map: new Group(),
      goals: new Group(),
      paths: new Group(),
      vectors: new Group(),
      agents: new Group(),
    };
    root.add(this.layers.map, this.layers.goals, this.layers.paths, this.layers.vectors, this.layers.agents);

    // Zoom + Pan (left or middle button to pan, wheel to zoom)
    this.zoomer = new ZoomPan(root, host, {   // NEW
      minScale: 0.05,
      maxScale: 20,
      wheelSpeed: 1 / 1000,
      panButton: ['left', 'middle'],
    });
  }

  async draw(map: any, solution: Solution) {
    if (!this.two || !this.root || !this.host) return;
    this.solution = solution;

    // drawMap writes into layers.map
    drawMap(this.two, this.layers, map);

    // IMPORTANT: set the initial view via ZUI only
    this.zoomer?.updateOffset();
    this.zoomer?.fitToSurface(map.width * CELL_SIZE, map.height * CELL_SIZE, 24);

    this.animateSolution();
    this.two.update();
  }

  private animateSolution() {
    if (!this.two || !this.solution) return;
    const two = this.two;

    // Reset animation state
    this.unbindUpdate?.();
    this.unbindUpdate = null;
    this.timestep = 0;

    const sol = this.solution;
    this.orientationAware = sol[0][0].orientation !== Orientation.NONE;

    // --- GOAL MARKERS ---
    sol[sol.length - 1].forEach((pose, agentId) => {
      const w = CELL_SIZE / 4;
      const marker = two.makeRectangle(this.scale(pose.position.x), this.scale(pose.position.y), w, w);
      marker.fill = AGENT_COLORS[agentId % AGENT_COLORS.length]!;
      marker.noStroke();
      marker.className = 'goal-marker';
      this.layers.goals.add(marker);
    });

    // --- PATHS: one Path per agent + animate `.ending` ---
    const segments = sol.length - 1;
    sol[0].forEach((_p, agentId) => {
      const verts: Anchor[] = sol.map(step =>
        new Anchor(this.scale(step[agentId].position.x), this.scale(step[agentId].position.y))
      );
      const trail = new Path(verts, false, false);
      trail.noFill();
      trail.stroke = AGENT_COLORS[agentId % AGENT_COLORS.length]!;
      trail.linewidth = CELL_SIZE / 10;
      trail.className = 'agent-trail';
      trail.ending = 0; // start hidden
      this.layers.paths.add(trail);
    });

    // --- AGENTS (one group per agent) ---
    sol[0].forEach((_pose, agentId) => {
      const agent = new Group();
      agent.className = 'agent';

      // Body (rotates)
      const body = new Group();
      body.className = 'agent-body';
      const r = CELL_SIZE / 3;
      const circle = two.makeCircle(0, 0, r);
      circle.fill = AGENT_COLORS[agentId % AGENT_COLORS.length]!;
      circle.noStroke();
      body.add(circle);

      if (this.orientationAware) {
        const tri = new Path([new Anchor(0, r), new Anchor(0, -r), new Anchor(r, 0)], true);
        tri.fill = BACKGROUND_COLOR;
        tri.noStroke();
        body.add(tri);
      }
      agent.add(body);

      // Label (stays upright)
      const idText = two.makeText(String(agentId), 0, 0);
      idText.size = (CELL_SIZE / 3) * FONT_SUPER_RESOLUTION_SCALE;
      idText.scale = 1 / FONT_SUPER_RESOLUTION_SCALE;
      idText.fill = TEXT_COLOR;
      idText.className = 'agent-label';
      agent.add(idText);

      this.layers.agents.add(agent);
    });

    // --- GOAL VECTORS (one Line per agent) ---
    sol[sol.length - 1].forEach((_pose, agentId) => {
      const line = two.makeLine(0, 0, 0, 0) as Line;
      line.stroke = AGENT_COLORS[agentId % AGENT_COLORS.length]!;
      line.linewidth = Math.max(1, CELL_SIZE / 25);
      line.cap = 'round';
      line.className = 'goal-vector';
      this.layers.vectors.add(line);
    });

    // --- ANIMATION LOOP ---
    const update = () => {
      if (this.playAnimation) {
        if (this.timestep < segments) this.timestep += this.stepSize / 60;
        else if (this.loopAnimation) this.timestep = 0;
      }
      const k = Math.min(this.timestep, segments);
      this.updateAgents(k);
      this.updateTrails(k, segments);
      this.updateGoalVectors();
    };

    two.bind('update', update);
    this.unbindUpdate = () => two.unbind('update', update);
  }

  private updateAgents(time: number) {
    if (!this.solution) return;
    const sol = this.solution;
    const t0 = Math.floor(time);
    const u = time - t0;

    this.layers.agents.children.forEach((agentGroup, i) => {
      const a = sol[t0][i], b = sol[Math.min(t0 + 1, sol.length - 1)][i];
      const x = this.lerp(a.position.x, b.position.x, u);
      const y = this.lerp(a.position.y, b.position.y, u);
      agentGroup.translation.set(this.scale(x), this.scale(y));

      if (this.orientationAware) {
        const body = (agentGroup as Group).children[0] as Group;
        const ra = orientationToRotation(a.orientation);
        const rb = orientationToRotation(b.orientation);
        body.rotation = this.lerp(ra, rb, u);
      }
    });
  }

  private updateTrails(time: number, segments: number) {
    const t = segments > 0 ? Math.max(0, Math.min(time / segments, 1)) : 1;
    this.layers.paths.children.forEach(p => (p as Path).ending = t);
  }

  private updateGoalVectors() {
    if (!this.solution) return;
    const goals = this.solution[this.solution.length - 1];

    this.layers.vectors.children.forEach((line, i) => {
      const agent = this.layers.agents.children[i] as Group;
      const goal = goals[i];
      (line as Line).vertices[0].set(agent.translation.x, agent.translation.y);
      (line as Line).vertices[1].set(this.scale(goal.position.x), this.scale(goal.position.y));
    });
  }

  private scale(n: number) { return n * CELL_SIZE + CELL_SIZE / 2; }
  private lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

  destroy() {
    this.unbindUpdate?.();
    this.unbindUpdate = null;

    this.zoomer?.destroy();
    this.zoomer = null;

    if (this.root && this.two) {
      this.root.remove();
      this.two.release(this.root);
      this.two.clear();
      this.two.pause();
    }
    this.root = null;
    this.two = null;
    this.host = null;
    this.solution = null;
  }
}
