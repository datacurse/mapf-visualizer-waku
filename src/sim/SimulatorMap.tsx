'use client'

import { useEffect, useRef } from 'react'
import { atom, useSetAtom } from 'jotai'
import { TwoController } from './TwoController'
import { onState, ensureSocket } from '../socketClient'

export const mapClass = atom<TwoController | null>(null)

export function SimulatorMap() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const setController = useSetAtom(mapClass)

  useEffect(() => {
    const ctl = new TwoController()
    setController(ctl)
    if (hostRef.current) ctl.mount(hostRef.current)
    ensureSocket()
    const off = onState(({ grid, robots, cellSizeM }) => {
      ctl.draw(grid)
      ctl.syncRobots(robots, cellSizeM)
    })
    return () => {
      off()
      ctl.destroy()
      setController(null)
    }
  }, [setController])

  return (
    <div className="flex w-full h-screen select-none" style={{ background: '#ffffff' }}>
      <div className="relative flex-1">
        <div ref={hostRef} className="absolute inset-0" />
      </div>
    </div>
  )
}
