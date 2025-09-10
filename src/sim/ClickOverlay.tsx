"use client"

import { useAtomValue } from "jotai"
import { useCallback, useRef } from "react"
import { gridAtom } from "./atoms"
import { sendMoveTo } from "./socketClient"

export default function ClickOverlay() {
  const grid = useAtomValue(gridAtom)
  const ref = useRef<HTMLDivElement | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!grid || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const cell = Math.min(rect.width / grid.width, rect.height / grid.height)
    const ox = (rect.width - cell * grid.width) / 2
    const oy = (rect.height - cell * grid.height) / 2
    const px = e.clientX - rect.left - ox
    const py = e.clientY - rect.top - oy
    if (px < 0 || py < 0) return
    const gx = Math.floor(px / cell)
    const gy = Math.floor(py / cell)
    if (gx < 0 || gy < 0 || gx >= grid.width || gy >= grid.height) return
    sendMoveTo(gx, gy)
  }, [grid])

  return <div ref={ref} className="absolute inset-0 z-40" onPointerDown={onPointerDown} />
}
