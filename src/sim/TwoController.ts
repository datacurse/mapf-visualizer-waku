import Two from 'two.js'
import { Group } from 'two.js/src/group'
import { Path } from 'two.js/src/path'
import { Anchor } from 'two.js/src/anchor'
import { ZoomPan } from '../ZoomPan'
import { drawGrid } from './drawGrid'
import { Grid } from './types'

const CELL_SIZE = 100
const AGENT_COLORS = ['#E91E63', '#2196F3', '#4CAF50', '#FF9800', '#00BCD4', '#9C27B0', '#795548', '#FFBB3B', '#F44336', '#607D8B', '#009688', '#3F51B5'] as const

type LayerName = 'map' | 'agents'
export type Layers = Record<LayerName, Group>

function agentColor(i: number) { return AGENT_COLORS[i % AGENT_COLORS.length]! }
function cellsFromMeters(v: number, cellSizeM: number) { return v / cellSizeM }
function pxFromMetersX(xm: number, cellSizeM: number) { return cellsFromMeters(xm, cellSizeM) * CELL_SIZE + CELL_SIZE / 2 }
function pxFromMetersY(ym: number, cellSizeM: number) { return cellsFromMeters(ym, cellSizeM) * CELL_SIZE + CELL_SIZE / 2 }
function deg2rad(d: number) { return (d * Math.PI) / 180 }

export class TwoController {
  private two: Two | null = null
  private root: Group | null = null
  private host: HTMLElement | null = null
  private layers!: Layers
  private zoomer: ZoomPan | null = null
  private robotShapes = new Map<string, Group>()
  private gridDrawnKey: string | null = null

  mount(host: HTMLElement) {
    this.destroy()
    this.two = new Two({ type: Two.Types.svg, fitted: true, autostart: true }).appendTo(host)
    this.host = host
    this.host.style.touchAction = 'none'
    const root = new Group()
    this.two.add(root)
    this.root = root
    this.layers = { map: new Group(), agents: new Group() }
    root.add(this.layers.map, this.layers.agents)
    this.zoomer = new ZoomPan(root, host, { minScale: 0.05, maxScale: 20, wheelSpeed: 1 / 1000, panButton: ['left', 'middle'] })
  }

  private gridKey(g: Grid) { return `${g.width}x${g.height}:${g.obstacles.size}` }

  draw(grid: Grid) {
    if (!this.two || !this.root || !this.host) return
    const key = this.gridKey(grid)
    if (this.gridDrawnKey !== key) {
      drawGrid(this.two, this.layers as any, grid)
      this.zoomer?.updateOffset()
      this.zoomer?.fitToSurface(grid.width * CELL_SIZE, grid.height * CELL_SIZE, 24)
      this.gridDrawnKey = key
      this.two.update()
    }
  }

  syncRobots(robots: ReadonlyArray<{ id: string; grid: { x: number; y: number; rotation: number }; absolute: { x: number; y: number; rotation_deg: number } }>, cellSizeM: number) {
    if (!this.two) return
    const seen = new Set<string>()
    robots.forEach((r, idx) => {
      seen.add(r.id)
      let g = this.robotShapes.get(r.id)
      if (!g) {
        g = new Group()
        const body = this.two!.makeCircle(0, 0, CELL_SIZE * 0.3)
        body.fill = agentColor(idx)
        body.noStroke()
        const tri = new Path([
          new Anchor(0, -CELL_SIZE * 0.32),
          new Anchor(-CELL_SIZE * 0.18, CELL_SIZE * 0.18),
          new Anchor(CELL_SIZE * 0.18, CELL_SIZE * 0.18),
        ], true)
        tri.fill = '#ffffff'
        tri.noStroke()
        g.add(body, tri)
        this.layers.agents.add(g)
        this.robotShapes.set(r.id, g)
      }
      g.translation.set(pxFromMetersX(r.absolute.x, cellSizeM), pxFromMetersY(r.absolute.y, cellSizeM))
      g.rotation = deg2rad(r.absolute.rotation_deg)
    })
    for (const [id, grp] of [...this.robotShapes]) {
      if (!seen.has(id)) {
        grp.remove()
        this.robotShapes.delete(id)
      }
    }
    this.two.update()
  }

  destroy() {
    this.zoomer?.destroy()
    this.zoomer = null
    if (this.root && this.two) {
      this.root.remove()
      this.two.release(this.root)
      this.two.clear()
      this.two.pause()
    }
    this.robotShapes.clear()
    this.root = null
    this.two = null
    this.host = null
    this.gridDrawnKey = null
  }
}
