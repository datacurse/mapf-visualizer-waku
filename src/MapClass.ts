import Two from 'two.js'
import { Group } from 'two.js/src/group'
import { getDefaultStore } from 'jotai'
import { Layers, RenderCtx } from './draw/renderCtx'
import { ZoomPan } from './ZoomPan'
import { drawMap } from './draw/drawMap'
import { Graph } from './Components/Graph'

export class MapClass {
  private two: Two | null = null
  private root: Group | null = null
  private host: HTMLElement | null = null
  private layers: Layers | null = null
  private ctx: RenderCtx | null = null
  private store = getDefaultStore()
  private zoomer: ZoomPan | null = null

  private visibilityHandler = () => { if (!this.two) return; if (document.hidden) this.two.pause(); else this.two.play() }

  mount(host: HTMLElement) {
    if (this.two) this.destroy()
    this.two = new Two({ type: Two.Types.svg, fitted: true, autostart: true }).appendTo(host)
    const root = new Group()
    const layers: Layers = { map: new Group(), agents: new Group(), goals: new Group(), paths: new Group(), goal_vectors: new Group() }
    root.add(layers.map, layers.agents, layers.goals, layers.paths, layers.goal_vectors)
    this.two.add(root)
    this.root = root
    this.layers = layers
    this.ctx = { two: this.two, layers }
    this.host = host
    this.zoomer = new ZoomPan(root, host, { minScale: 0.05, maxScale: 20, wheelSpeed: 1 / 1000, panButton: ['left', 'middle'] })
    document.addEventListener('visibilitychange', this.visibilityHandler)
  }

  async draw(graph: Graph) {
    console.log(this.two, this.layers, this.ctx)
    if (!this.two || !this.layers || !this.ctx) return

    console.log("drawing")
    drawMap(this.ctx, graph)

    this.two.update()
  }

  private clearGroup(group: Group) {
    const toRelease = group.children.slice()
    if (toRelease.length) group.remove(...toRelease)
    if (!this.two) return
    for (const child of toRelease) this.two.release(child)
  }

  destroy() {
    if (!this.two) return
    document.removeEventListener('visibilitychange', this.visibilityHandler)
    if (this.layers) {
      // this.clearGroup(this.layers.background)
      // this.clearGroup(this.layers.places)
      // this.clearGroup(this.layers.markers)
      // this.clearGroup(this.layers.tracks)
      // this.clearGroup(this.layers.devices)
    }
    this.zoomer?.destroy()
    this.zoomer = null
    this.two.pause()
    this.two.clear()
    const el = (this.two.renderer as any)?.domElement as HTMLElement | null
    el?.parentElement?.removeChild(el)
    this.root = null
    this.layers = null
    this.ctx = null
    this.two = null
    this.host = null
  }
}
