// ZoomPan.ts
import { Group } from 'two.js/src/group'
import { ZUI } from 'two.js/extras/jsm/zui'

type MouseButton = 'left' | 'middle' | 'right'
type ZoomPanOptions = {
  minScale?: number
  maxScale?: number
  wheelSpeed?: number
  panButton?: MouseButton | MouseButton[]
}

export class ZoomPan {
  private host: HTMLElement
  private group: Group
  private zui: ZUI
  private ro: ResizeObserver
  private opts: Omit<Required<ZoomPanOptions>, 'panButton'> & { panButton: MouseButton[] }
  private dragging = false
  private lastX = 0
  private lastY = 0

  constructor(group: Group, host: HTMLElement, opts?: ZoomPanOptions) {
    this.group = group
    this.host = host
    const pan = opts?.panButton
    const panButtons = typeof pan === 'string' ? [pan] : Array.isArray(pan) ? pan : ['middle']

    this.opts = {
      minScale: 0.05,
      maxScale: 20,
      wheelSpeed: 1 / 1000,
      panButton: panButtons,
      ...opts,
    }

    this.zui = new ZUI(group, host)
    this.zui.addLimits(this.opts.minScale, this.opts.maxScale)

    this.onWheel = this.onWheel.bind(this)
    this.onPointerDown = this.onPointerDown.bind(this)
    this.onPointerMove = this.onPointerMove.bind(this)
    this.onPointerUp = this.onPointerUp.bind(this)

    host.addEventListener('wheel', this.onWheel, { passive: false })
    host.addEventListener('pointerdown', this.onPointerDown)
    host.addEventListener('pointermove', this.onPointerMove)
    host.addEventListener('pointerup', this.onPointerUp)
    host.addEventListener('pointercancel', this.onPointerUp)

    this.ro = new ResizeObserver(() => this.zui.updateOffset())
    this.ro.observe(host)
    this.zui.updateOffset()
  }

  destroy() {
    this.ro.disconnect()
    this.host.removeEventListener('wheel', this.onWheel)
    this.host.removeEventListener('pointerdown', this.onPointerDown)
    this.host.removeEventListener('pointermove', this.onPointerMove)
    this.host.removeEventListener('pointerup', this.onPointerUp)
    this.host.removeEventListener('pointercancel', this.onPointerUp)
  }

  // ---------- public helpers (NEW) ----------
  /** Recalc DOM-to-surface mapping (safe to call anytime). */
  public updateOffset() {
    this.zui.updateOffset()
  }

  /** Set initial view using ZUI only (no direct group.translation). */
  public setView(scale: number, offsetX: number, offsetY: number) {
    this.zui.reset()               // start at identity
    this.zui.updateOffset()
    this.zui.zoomSet(scale, 0, 0)  // anchor top-left while scaling
    this.zui.translateSurface(offsetX, offsetY) // pan in client pixels
  }

  /** Fit a w×h surface into the host with optional padding, clamped to limits. */
  public fitToSurface(surfaceW: number, surfaceH: number, padding = 24) {
    const vw = this.host.clientWidth
    const vh = this.host.clientHeight
    const scaleRaw = Math.min(
      (vw - padding * 2) / surfaceW,
      (vh - padding * 2) / surfaceH
    )
    const scale = Math.max(this.opts.minScale, Math.min(scaleRaw, this.opts.maxScale))
    const offsetX = (vw - surfaceW * scale) / 2
    const offsetY = (vh - surfaceH * scale) / 2
    this.setView(scale, offsetX, offsetY)
  }

  // ---------- internals ----------
  private onWheel(e: WheelEvent) {
    e.preventDefault()
    this.zui.zoomBy(-e.deltaY * this.opts.wheelSpeed, e.clientX, e.clientY)
  }

  private onPointerDown(e: PointerEvent) {
    const buttonMap: Record<number, MouseButton> = { 0: 'left', 1: 'middle', 2: 'right' }
    const buttonName = buttonMap[e.button]
    if (!buttonName || !this.opts.panButton.includes(buttonName)) return
    this.dragging = true
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.host.setPointerCapture?.(e.pointerId)
    this.host.style.cursor = 'grabbing'
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.dragging) return
    const dx = e.clientX - this.lastX
    const dy = e.clientY - this.lastY
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.zui.translateSurface(dx, dy)
  }

  private onPointerUp(e: PointerEvent) {
    if (this.dragging) {
      this.dragging = false
      this.host.releasePointerCapture?.(e.pointerId)
      this.host.style.cursor = ''
    }
  }
}
