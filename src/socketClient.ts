import { io, Socket } from 'socket.io-client'
import type { Grid } from './sim/types'

type WireGrid = { width: number; height: number; obstacles: number[][] }
type WireRobot = { id: string; x: number; y: number }
type WireState = { grid: WireGrid; robots: WireRobot[] }

let socket: Socket | null = null
const listeners = new Set<(state: { grid: Grid; robots: WireRobot[] }) => void>()

function toKey(x: number, y: number) { return `(${x}, ${y})` }

function toGrid(w: WireGrid): Grid {
  const m = new Map<string, boolean>()
  for (const [x, y] of w.obstacles) m.set(toKey(x, y), true)
  return { width: w.width, height: w.height, obstacles: m }
}

export function ensureSocket() {
  if (!socket) {
    socket = io('http://localhost:8000', { transports: ['websocket'] })
    socket.on('game_state', (ws: WireState) => {
      const grid = toGrid(ws.grid)
      const robots = ws.robots
      for (const cb of listeners) cb({ grid, robots })
    })
  }
  return socket
}

export function onState(cb: (state: { grid: Grid; robots: WireRobot[] }) => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function sendMove(dir: 'left' | 'right' | 'up' | 'down', id = 'r1') {
  ensureSocket().emit('move', { id, dir })
}
