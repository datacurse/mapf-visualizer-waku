// src/features/map/TwoCanvas.tsx
'use client'

import { useEffect, useRef } from 'react'
import { atom, useSetAtom } from 'jotai'
import { readMap, readSolution } from './read'
import { CanvasClass } from './CanvasClass'

export const mapClass = atom<CanvasClass | null>(null)

export function VisualizerMap() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const setController = useSetAtom(mapClass)

  useEffect(() => {
    const initializeMap = async () => {
      const map = await readMap()
      const solution = await readSolution()
      const ctl = new CanvasClass()
      setController(ctl)
      if (hostRef.current) ctl.mount(hostRef.current)
      ctl.draw(map, solution)
      // ctl.setPlayAnimation(true);
      return () => {
        ctl.destroy()
        setController(null)
      }
    }

    initializeMap()

    // Clean-up function
    return () => setController(null)
  }, [setController])

  return (
    <div className="flex w-full h-screen select-none" style={{ background: '#ffffff' }}>
      <div className="relative flex-1">
        <div ref={hostRef} className="absolute inset-0" />
      </div>
    </div>
  )
}
