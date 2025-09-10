"use client"

import { Suspense, useEffect } from 'react'
import { ensureSocket, sendMove } from '../socketClient'
import { SimulatorMap } from '../sim/SimulatorMap'

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
