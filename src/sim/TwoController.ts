import Two from 'two.js'
import { Group } from 'two.js/src/group'
import { Path } from 'two.js/src/path'
import { Anchor } from 'two.js/src/anchor'
import { ZoomPan } from '../ZoomPan'
import { drawGrid } from './drawGrid'
import { renderFpsAtom } from './renderFpsAtom'
import { getDefaultStore } from 'jotai'
import { GameState } from './socketClient'

const CELL_SIZE = 100
const AGENT_COLORS = ['#E91E63', '#2196F3', '#4CAF50', '#FF9800', '#00BCD4', '#9C27B0', '#795548', '#FFBB3B', '#F44336', '#607D8B', '#009688', '#3F51B5'] as const

type LayerName = 'map' | 'agents'
export type Layers = Record<LayerName, Group>
export type Robot = {
  id: string
  grid: { x: number; y: number; rotation: number }
  absolute: { x: number; y: number; rotationDeg: number }
}

function agentColor(i: number) { return AGENT_COLORS[i % AGENT_COLORS.length]! }
function cellsFromMeters(v: number, cellSizeM: number) { return v / cellSizeM }
function pxFromMetersX(xm: number, cellSizeM: number) { return cellsFromMeters(xm, cellSizeM) * CELL_SIZE + CELL_SIZE / 2 }
function pxFromMetersY(ym: number, cellSizeM: number) { return cellsFromMeters(ym, cellSizeM) * CELL_SIZE + CELL_SIZE / 2 }
function deg2rad(d: number) { return (d * Math.PI) / 180 }
function isFiniteNumber(n: unknown): n is number { return typeof n === 'number' && Number.isFinite(n) }

export class TwoController {
  private two: Two | null = null
  private root: Group | null = null
  private host: HTMLElement | null = null
  private layers!: Layers
  private zoomer: ZoomPan | null = null
  private robotShapes = new Map<string, Group>()
  private gridDrawnKey: string | null = null
  private unbindUpdate: (() => void) | null = null
  private frames = 0
  private elapsedMs = 0
  private store = getDefaultStore()

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

    const onUpdate = (_frameCount: number, timeDelta: number) => {
      this.frames += 1
      this.elapsedMs += timeDelta
      if (this.elapsedMs >= 1000) {
        const fps = (this.frames * 1000) / this.elapsedMs
        this.store.set(renderFpsAtom, fps)
        this.frames = 0
        this.elapsedMs = 0
      }
    }
    this.two.bind('update', onUpdate)
    this.unbindUpdate = () => this.two?.unbind('update', onUpdate)
  }

  private gridKey(g: GameState['grid']) {
    return `${g.width}x${g.height}:${g.obstacles.length}`
  }

  draw(grid: GameState['grid']) {
    if (!this.two || !this.root || !this.host) return
    const key = this.gridKey(grid)
    if (this.gridDrawnKey !== key) {
      drawGrid(this.two, this.layers as any, grid)
      const w = this.host.clientWidth || 0
      const h = this.host.clientHeight || 0
      if (w > 0 && h > 0) {
        this.zoomer?.updateOffset()
        this.zoomer?.fitToSurface(grid.width * CELL_SIZE, grid.height * CELL_SIZE, 24)
      }
      this.gridDrawnKey = key
    }
  }

  syncRobots(robots: GameState['robots'], cellSizeM: number) {
    if (!this.two) return
    if (!isFiniteNumber(cellSizeM) || cellSizeM <= 0) return
    const seen = new Set<string>()
    robots.forEach((r, idx) => {
      if (!isFiniteNumber(r.absolute.x) || !isFiniteNumber(r.absolute.y) || !isFiniteNumber(r.absolute.rotationDeg)) return
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
      const tx = pxFromMetersX(r.absolute.x, cellSizeM)
      const ty = pxFromMetersY(r.absolute.y, cellSizeM)
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) return
      g.translation.set(tx, ty)
      const rot = deg2rad(r.absolute.rotationDeg)
      g.rotation = Number.isFinite(rot) ? rot : 0
    })
    for (const [id, grp] of [...this.robotShapes]) {
      if (!seen.has(id)) {
        grp.remove()
        this.robotShapes.delete(id)
      }
    }
  }

  destroy() {
    this.unbindUpdate?.()
    this.unbindUpdate = null
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
