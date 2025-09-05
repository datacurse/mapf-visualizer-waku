import { Circle } from "two.js/src/shapes/circle"
import { Coordinate, Graph } from "../Components/Graph"
import { RenderCtx } from "./renderCtx"
import { Group } from "two.js/src/group"

const CELL_SIZE = 100
const CELL_STROKE_WIDTH = 10
const CELL_STROKE_COLOR = "#000000"

// const colors = {
//   "00": "red",
//   "01": "green",
//   "10": "blue",
//   "11": "yellow"
// }

export function drawMap(ctx: RenderCtx, graph: Graph): void {
  for (let x: number = 0; x < graph.width; x++) {
    for (let y: number = 0; y < graph.height; y++) {
      const cellX = x * CELL_SIZE;
      const cellY = y * CELL_SIZE;
      const cellGroup = new Group()
      // We have cellGroup here because we might want to add index of a cell on that.
      const cell = ctx.two.makeRectangle(cellX + CELL_SIZE / 2 + CELL_STROKE_WIDTH / 2,
        cellY + CELL_SIZE / 2 + CELL_STROKE_WIDTH / 2,
        CELL_SIZE, CELL_SIZE)
      // cell.stroke = colors[x.toString() + y.toString()]
      cell.stroke = CELL_STROKE_COLOR
      cell.linewidth = CELL_STROKE_WIDTH
      cell.noFill()
      if (graph.obstacles.has(new Coordinate(x, y).toString())) {
        cell.fill = CELL_STROKE_COLOR
      }
      // We will add text here. Its visibility will be toggable from the outside. We will for loop over all cells and get second element in the group and change its visibility. Instead of choosing here whether or not to draw it. Not sure if its a good idea tho, cuz it is not explicit. How much time redrawing takes? Tho it makes more sense to be completely honest. Not sure.
      cellGroup.add(cell)
      ctx.layers.map.add(cellGroup)
    }
  }
  // ctx.layers.map.add(new Circle(0, 0, 1))
}