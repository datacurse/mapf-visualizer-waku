"use client"

import { Suspense, useEffect } from 'react'
import { SimulatorMap } from '../sim/SimulatorMap'
import { ensureSocket, sendMove } from '../sim/socketClient'

export default function HomePage() {
  useEffect(() => { ensureSocket() }, [])

  return (
    <Suspense fallback={<p>Loading...</p>}>
      <div className="flex h-screen flex-col">
        <div className="fixed top-4 right-4 z-50 flex gap-2">
          <button onClick={() => sendMove('left')} className="rounded-md px-3 py-2 bg-black text-white">◀</button>
          <button onClick={() => sendMove('up')} className="rounded-md px-3 py-2 bg-black text-white">▲</button>
          <button onClick={() => sendMove('down')} className="rounded-md px-3 py-2 bg-black text-white">▼</button>
          <button onClick={() => sendMove('right')} className="rounded-md px-3 py-2 bg-black text-white">▶</button>
        </div>
        <SimulatorMap />
      </div>
    </Suspense>
  )
}
