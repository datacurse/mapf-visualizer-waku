"use client"

import { Suspense, useEffect } from 'react'
import { Map } from '../Map'
import { ensureSocket } from '../socketClient'

export default function HomePage() {
  useEffect(() => {
    ensureSocket()
  }, [])

  return (
    <Suspense fallback={<p>Loading...</p>}>
      <div className="flex h-screen flex-col">
        <Map />
      </div>
    </Suspense>
  )
}
