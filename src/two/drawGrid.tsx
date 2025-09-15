import Two from 'two.js'
import { Group } from 'two.js/src/group'
import { Layers } from '../ts/TwoController'
import { TopLeftRectangle } from '@/two/TopLeftRectangle'
import { Grid } from '@/ts/types'

const CELL_SIZE = 100
const CELL_STROKE_WIDTH = 10
const CELL_STROKE_COLOR = '#000000'
const TEXT_SIZE = CELL_SIZE / 4

const key = (x: number, y: number) => `${x},${y}`


export function drawGrid(two: Two, layers: Layers, grid: Grid): Group {
  const layer = layers.map
  const cellsGroup = new Group()
  cellsGroup.className = 'cells'
  layer.add(cellsGroup)

  const obstacleSet = new Set(grid.obstacles.map(([x, y]) => key(x, y)))

  for (let x = 0; x < grid.width; x++) {
    for (let y = 0; y < grid.height; y++) {
      const cellX = x * CELL_SIZE
      const cellY = y * CELL_SIZE

      const cellGroup = new Group()
      cellGroup.className = 'cell'
      cellsGroup.add(cellGroup)

      const cell = new TopLeftRectangle(cellX, cellY, CELL_SIZE, CELL_SIZE)
      cell.stroke = CELL_STROKE_COLOR
      cell.linewidth = CELL_STROKE_WIDTH
      cell.fill = obstacleSet.has(key(x, y)) ? CELL_STROKE_COLOR : 'transparent'
      cellGroup.add(cell)

      const text = two.makeText(`${x},${y}`, cellX + CELL_STROKE_WIDTH * 1.5, cellY + CELL_STROKE_WIDTH * 2)
      text.size = TEXT_SIZE
      text.alignment = 'left'
      text.className = 'cell-index'
      cellGroup.add(text)
    }
  }

  return cellsGroup
}
