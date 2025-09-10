// src/sim/socketClient.ts
"use client"

import { io, Socket } from "socket.io-client"

type GameState = {
  grid: { width: number; height: number; obstacles: [number, number][] }
  cell_size_m: number
  robots: {
    id: string
    grid: { x: number; y: number; rotation: number }
    absolute: { x: number; y: number; rotation_deg: number }
  }[]
}

let socket: Socket | null = null
type Listener = (s: { grid: { width: number; height: number; obstacles: Set<string> }; robots: GameState["robots"]; cellSizeM: number }) => void
const listeners = new Set<Listener>()

export function ensureSocket() {
  if (socket) return socket
  socket = io("http://localhost:8000", { transports: ["websocket"] })
  socket.on("game_state", (s: GameState) => {
    const obstacles = new Set(s.grid.obstacles.map(([x, y]) => `${x},${y}`))
    const payload = { grid: { width: s.grid.width, height: s.grid.height, obstacles }, robots: s.robots, cellSizeM: s.cell_size_m }
    listeners.forEach(fn => fn(payload))
  })
  return socket
}

export function onState(cb: Listener) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function sendMoveTo(x: number, y: number, id = "r1") {
  if (!socket) ensureSocket()
  socket!.emit("move_to", { id, x, y })
}
