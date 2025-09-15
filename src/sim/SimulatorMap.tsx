"use client"

import { useEffect, useRef } from "react"
import { useSetAtom } from "jotai"
import { TwoController } from "./TwoController"
import { ensureSocket, onState } from "./socketClient"
import ClickOverlay from "./ClickOverlay"
import { gridAtom, mapClass } from "./atoms"

export function SimulatorMap() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const setController = useSetAtom(mapClass)
  const setGrid = useSetAtom(gridAtom)

  useEffect(() => {
    const ctl = new TwoController()
    setController(ctl)
    if (hostRef.current) ctl.mount(hostRef.current)
    ensureSocket()
    const off = onState((s) => {
      console.log(s)
      setGrid(s.grid)
      ctl.draw(s)
      ctl.syncRobots(s.robots, s.cellSizeM)
    })
    return () => {
      off()
      ctl.destroy()
      setController(null)
      setGrid(null)
    }
  }, [setController, setGrid])

  return (
    <div className="flex w-full h-screen select-none" style={{ background: "#ffffff" }}>
      <div className="relative flex-1">
        <div ref={hostRef} className="absolute inset-0" />
        <ClickOverlay />
      </div>
    </div>
  )
}
