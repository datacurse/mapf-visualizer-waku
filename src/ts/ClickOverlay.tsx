"use client"

import { useRef } from "react"

export default function ClickOverlay() {
  const ref = useRef<HTMLDivElement | null>(null)

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    console.log("Clicked inside canvas at:", x, y)
  }

  return (
    <div
      ref={ref}
      className="absolute inset-0 z-40"
      onPointerDown={handlePointerDown}
    />
  )
}
