import { useSyncExternalStore } from 'react'

let fps = 0
let count = 0
let last = typeof performance !== 'undefined' ? performance.now() : Date.now()
const listeners = new Set<() => void>()

export function notePacket() {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  count++
  const dt = now - last
  if (dt >= 1000) {
    fps = (count * 1000) / dt
    count = 0
    last = now
    listeners.forEach(l => l())
  }
}

function getSnapshot() { return fps }

export function useFPS() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    getSnapshot,
    getSnapshot
  )
}
