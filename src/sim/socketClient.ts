"use client"

import { io, Socket } from "socket.io-client"

export type Cell = [number, number]
export type Path = Cell[]

export type GameState = {
  grid: { width: number; height: number; obstacles: [number, number][] }
  cellSizeM: number
  base: { x: number; y: number }
  destinationBins: { id: number; x: number; y: number; capacity: number; items: unknown[] }[]
  robots: {
    id: string
    grid: { x: number; y: number; rotation: number }
    absolute: { x: number; y: number; rotationDeg: number }
    path: Path | null
  }[]
}

let socket: Socket | null = null

type Listener = (s: GameState) => void
const listeners = new Set<Listener>()

export function ensureSocket() {
  if (socket) return socket
  socket = io("http://localhost:8000", { transports: ["websocket"] })
  socket.on("game_state", (s: GameState) => {
    listeners.forEach(fn => fn(s))
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
