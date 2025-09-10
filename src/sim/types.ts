export type Coordinate = {
  x: number
  y: number
}

export type Grid = {
  width: number
  height: number
  obstacles: Map<string, boolean>
}

export type Direction = 'left' | 'right' | 'up' | 'down'