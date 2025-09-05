// src/features/map/TwoCanvas.tsx
'use client'

import { useEffect, useRef } from 'react'
import { atom, useSetAtom } from 'jotai'
import { readMap } from './Components/read'
import { MapClass } from './MapCLass'

export const mapClass = atom<MapClass | null>(null)

export function Map() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const setController = useSetAtom(mapClass)

  useEffect(() => {
    const initializeMap = async () => {
      const map = await readMap()
      const ctl = new MapClass()
      setController(ctl)
      if (hostRef.current) ctl.mount(hostRef.current)
      ctl.draw(map)

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
    <div className="flex w-full h-screen select-none" style={{ background: '#bbb' }}>
      <div className="relative flex-1">
        <div ref={hostRef} className="absolute inset-0" />
      </div>
    </div>
  )
}
