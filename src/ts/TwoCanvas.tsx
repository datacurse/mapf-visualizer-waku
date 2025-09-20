"use client"

import { useEffect, useRef } from "react"
import { TwoController } from "./TwoController"
import { TwoController2 } from "./TwoController2"
import { TwoControllerMapd } from "./TwoControllerMapd"

export function TwoCanvas() {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const ctl = new TwoControllerMapd(); // 8 robots, colors from palette
    if (hostRef.current) ctl.mount(hostRef.current)
    return () => ctl.destroy()
  }, [])

  return (
    <div className="flex w-full h-screen select-none" style={{ background: "#ffffff" }}>
      <div ref={hostRef} className="absolute inset-0" />
    </div>
  )
}
