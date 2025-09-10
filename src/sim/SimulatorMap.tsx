'use client'

import { useEffect, useRef } from 'react'
import { atom, useSetAtom } from 'jotai'
import { TwoController } from './TwoController'
import { onState, ensureSocket } from '../socketClient'

export const mapClass = atom<TwoController | null>(null)

export function SimulatorMap() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const setController = useSetAtom(mapClass)
  const ctlRef = useRef<TwoController | null>(null)
  const drawnRef = useRef(false)

  useEffect(() => {
    const ctl = new TwoController()
    ctlRef.current = ctl
    setController(ctl)
    if (hostRef.current) ctl.mount(hostRef.current)
    const unsub = onState(({ grid, robots }) => {
      if (!drawnRef.current) {
        ctl.draw(grid)
        drawnRef.current = true
      }
      ctl.syncRobots(robots)
    })
    ensureSocket()
    return () => {
      unsub()
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
