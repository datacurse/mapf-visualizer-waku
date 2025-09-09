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

type LayerName = 'map' | 'goals' | 'trials' | 'vectors' | 'agents';
export type Layers = Record<LayerName, Group>

function getAgentColor(agentId: number) {
  return AGENT_COLORS[agentId % AGENT_COLORS.length]!
}

type TrailProgress = {
  segLens: number[];
  cum: number[];   // cumulative lengths (same length as verts)
  total: number;   // total path length
};

export class MapClass {
  private two: Two | null = null;
  private root: Group | null = null;
  private host: HTMLElement | null = null;

  private layers!: Layers;
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
      trials: new Group(),
      vectors: new Group(),
      agents: new Group(),
    };
    root.add(this.layers.map, this.layers.goals, this.layers.trials, this.layers.vectors, this.layers.agents);

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
    if (!sol[0]) return;
    const firstPose = sol[0][0];
    if (!firstPose) return;
    this.orientationAware = firstPose.orientation !== Orientation.NONE;

    // Trails (precompute per-trail distance tables)
    const segments = sol.length - 1;
    sol[0].forEach((_p, agentId) => {
      const verts: Anchor[] = sol.map((step, stepIndex) => {
        const agent = step[agentId];
        if (!agent) {
          throw new Error(`Invalid solution: missing agent ${agentId} at step ${stepIndex}`);
        }
        return new Anchor(this.scale(agent.position.x), this.scale(agent.position.y));
      });

      const trail = new Path(verts, false, false);
      trail.noFill();
      trail.stroke = getAgentColor(agentId);
      trail.linewidth = CELL_SIZE / 10;
      trail.cap = 'round';
      trail.className = 'trail';
      trail.ending = 0;

      // --- NEW: precompute segment/cumulative lengths to drive Path.ending by distance
      const pts = verts.map(v => ({ x: v.x, y: v.y }));
      const segLens: number[] = [];
      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const dx = pts[i + 1].x - pts[i].x;
        const dy = pts[i + 1].y - pts[i].y;
        const len = Math.hypot(dx, dy);
        segLens.push(len);
        total += len;
      }
      const cum: number[] = [0];
      for (let i = 0; i < segLens.length; i++) cum.push(cum[i] + segLens[i]);

      (trail as Path & { _progress?: TrailProgress })._progress = { segLens, cum, total };

      this.layers.trials.add(trail);
    });

    // Agents
    sol[0].forEach((_pose, agentId) => {
      const agent = new Group();
      agent.className = 'agent';

      // Body
      const body = new Group();
      body.className = 'agent-body';
      const r = CELL_SIZE / 3;
      const circle = two.makeCircle(0, 0, r);
      circle.fill = getAgentColor(agentId);
      circle.noStroke();
      body.add(circle);

      if (this.orientationAware) {
        const tri = new Path([new Anchor(0, r), new Anchor(0, -r), new Anchor(r, 0)], true);
        tri.fill = BACKGROUND_COLOR;
        tri.noStroke();
        body.add(tri);
      }

      // Label
      const idText = two.makeText(String(agentId), 0, 0);
      idText.size = (CELL_SIZE / 3) * FONT_SUPER_RESOLUTION_SCALE;
      idText.scale = 1 / FONT_SUPER_RESOLUTION_SCALE;
      idText.fill = TEXT_COLOR;
      idText.baseline = 'baseline'
      idText.className = 'agent-label';
      const boundingBox = idText.getBoundingClientRect()
      // const boundingBoxRect = two.makeRectangle(0, 0, boundingBox.width, boundingBox.height).noStroke();
      idText.position.y = boundingBox.height / 2
      agent.add(body, idText);


      this.layers.agents.add(agent);
    });

    // Goal Markers
    const lastPose = sol[sol.length - 1];
    if (!lastPose) return;
    lastPose.forEach((pose, agentId) => {
      const w = CELL_SIZE / 4;
      const marker = two.makeRectangle(this.scale(pose.position.x), this.scale(pose.position.y), w, w);
      marker.fill = getAgentColor(agentId);
      marker.noStroke();
      marker.className = 'marker';
      this.layers.goals.add(marker);
    });

    // Goal Vectors
    lastPose.forEach((_pose, agentId) => {
      const line = two.makeLine(0, 0, 0, 0) as Line;
      line.stroke = getAgentColor(agentId);
      line.linewidth = Math.max(1, CELL_SIZE / 25);
      line.cap = 'round';
      line.className = 'vector';
      this.layers.vectors.add(line);
    });

    // Animation Loop (time-based)
    const update = (_frameCount: number, timeDelta: number) => {
      const dt = timeDelta / 1000; // seconds since last frame

      if (this.playAnimation) {
        this.timestep += this.stepSize * dt; // steps per second
        if (this.timestep >= segments) {
          this.timestep = this.loopAnimation ? 0 : segments;
        }
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
    if (sol.length === 0) throw new Error("Invalid solution: no timesteps");

    const t0 = Math.floor(time);
    if (t0 < 0 || t0 >= sol.length) throw new Error(`Invalid timestep: ${t0}`);
    const t1 = Math.min(t0 + 1, sol.length - 1);
    const u = time - t0;

    this.layers.agents.children.forEach((agentGroup, i) => {
      const a = sol[t0][i];
      const b = sol[t1][i];
      if (!a) throw new Error(`Invalid solution: missing agent ${i} at step ${t0}`);
      if (!b) throw new Error(`Invalid solution: missing agent ${i} at step ${t1}`);

      const x = this.lerp(a.position.x, b.position.x, u);
      const y = this.lerp(a.position.y, b.position.y, u);
      agentGroup.translation.set(this.scale(x), this.scale(y));

      if (this.orientationAware) {
        const body = (agentGroup as Group).children[0] as Group;
        if (!body) throw new Error(`Agent ${i} has no body group`);

        const ra = orientationToRotation(a.orientation);
        const rb = orientationToRotation(b.orientation);
        body.rotation = this.lerp(ra, rb, u);
      }
    });
  }

  private updateTrails(time: number, segments: number) {
    // Drive Path.ending by actual distance traveled along each trail
    const t0 = Math.floor(time);
    const u = time - t0; // [0,1) within the current step

    this.layers.trials.children.forEach((p) => {
      const path = p as Path & { _progress?: TrailProgress };
      const prog = path._progress;
      if (!prog || prog.total === 0) {
        // fallback to index-based fraction
        path.ending = Math.min(1, segments > 0 ? time / segments : 1);
        return;
      }
      const idx = Math.min(t0, prog.segLens.length - 1);
      const traveled = prog.cum[idx] + u * (prog.segLens[idx] || 0);
      path.ending = Math.min(1, traveled / prog.total);
    });
  }

  private updateGoalVectors() {
    if (!this.solution) return;
    if (this.solution.length === 0) throw new Error("Invalid solution: no timesteps");

    const goals = this.solution[this.solution.length - 1];
    if (!goals || goals.length === 0) throw new Error("Invalid solution: no goals in last timestep");

    this.layers.vectors.children.forEach((line, i) => {
      const agent = this.layers.agents.children[i] as Group | undefined;
      if (!agent) throw new Error(`Missing agent group for agent ${i}`);

      const goal = goals[i];
      if (!goal) throw new Error(`Missing goal pose for agent ${i}`);

      const lineShape = line as Line;
      if (lineShape.vertices.length < 2) throw new Error(`Line for agent ${i} is malformed`);

      lineShape.vertices[0].set(agent.translation.x, agent.translation.y);
      lineShape.vertices[1].set(this.scale(goal.position.x), this.scale(goal.position.y));
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
