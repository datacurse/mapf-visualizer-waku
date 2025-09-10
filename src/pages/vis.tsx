"use client"

import { Suspense, useEffect } from 'react'
import { VisualizerMap } from '../vis/VisualizerMap'
import { ensureSocket, sendPong } from '../socketClient'

export default function Vis() {
  useEffect(() => {
    ensureSocket()
  }, [])

  return (
    <Suspense fallback={<p>Loading...</p>}>
      <div className="flex h-screen flex-col">
        <button
          onClick={sendPong}
          className="fixed top-4 right-4 z-50 rounded-md px-4 py-2 bg-black text-white"
        >
          Send pong
        </button>
        <VisualizerMap />
      </div>
    </Suspense>
  )
}
