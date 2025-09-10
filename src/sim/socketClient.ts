import { io, Socket } from 'socket.io-client'
import { notePacket } from './fps'
import { Grid } from './types';
import type { Direction } from './types'

type WireGrid = { width: number; height: number; obstacles: number[][] }
type WireRobot = {
  id: string
  grid: { x: number; y: number; rotation: number }
  absolute: { x: number; y: number; rotation_deg: number }
}
type WireState = { grid: WireGrid; cell_size_m: number; robots: WireRobot[] }

let socket: Socket | null = null
const listeners = new Set<(state: { grid: Grid; robots: WireRobot[]; cellSizeM: number }) => void>()

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
      notePacket()
      const grid = toGrid(ws.grid)
      for (const cb of listeners) cb({ grid, robots: ws.robots, cellSizeM: ws.cell_size_m })
    })
  }
  return socket
}

export function onState(cb: (state: { grid: Grid; robots: WireRobot[]; cellSizeM: number }) => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}


export function sendMove(dir: Direction, id = 'r1') {
  ensureSocket().emit('move', { id, dir })
}

