"use client"

import ClickOverlay from "@/ts/ClickOverlay"
import { TwoCanvas } from "@/ts/TwoCanvas"

export default function HomePage() {
  return (
    <div className="flex h-screen flex-col">
      <div className="relative grow">
        <TwoCanvas />
        <ClickOverlay />
      </div>
    </div>
  )
}
