"use client"

import { Suspense, useEffect } from 'react'
import { VisualizerMap } from '../vis/VisualizerMap'


export default function HomePage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <div className="flex h-screen flex-col">
        <VisualizerMap />
      </div>
    </Suspense>
  )
}
