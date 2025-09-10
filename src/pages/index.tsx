"use client"

import { Suspense, useEffect } from "react"
import { SimulatorMap } from "../sim/SimulatorMap"
import { ensureSocket, sendMove } from "../sim/socketClient"
import { Direction } from "../sim/types"
import { useFPS } from "../sim/fps"               // data (socket) FPS
import { useAtomValue } from "jotai"              // NEW
import { renderFpsAtom } from "../sim/renderFpsAtom" // NEW

function MoveButton({ direction, label }: { direction: Direction; label: string }) {
  return (
    <button
      onClick={() => sendMove(direction)}
      className="rounded-md px-3 py-2 bg-black text-white"
    >
      {label}
    </button>
  )
}

export default function HomePage() {
  const dataFps = useFPS()
  const renderFps = useAtomValue(renderFpsAtom) // NEW

  useEffect(() => { ensureSocket() }, [])

  return (
    <Suspense fallback={<p>Loading...</p>}>
      <div className="flex h-screen flex-col">
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <MoveButton direction="left" label="◀" />
          <MoveButton direction="up" label="▲" />
          <MoveButton direction="down" label="▼" />
          <MoveButton direction="right" label="▶" />
          <div className="px-3 py-2 bg-white/90 backdrop-blur rounded border">
            RX {Math.round(dataFps)} fps
          </div>
          <div className="px-3 py-2 bg-white/90 backdrop-blur rounded border">
            Render {Math.round(renderFps)} fps
          </div>
        </div>
        <SimulatorMap />
      </div>
    </Suspense>
  )
}
