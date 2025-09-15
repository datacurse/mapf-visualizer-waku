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

export type Robot = {
  id: string
  grid: { x: number; y: number; rotation: number }
  absolute: { x: number; y: number; rotationDeg: number }
  path: Path | null
}

export type Grid = {
  width: number;
  height: number;
  obstacles: Obstacle[]
}

export type Obstacle = [number, number]

export type DestinationBin = {
  id: number;
  x: number;
  y: number;
  capacity: number;
  items: unknown[]
}