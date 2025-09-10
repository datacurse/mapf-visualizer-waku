// draw/drawMap.ts
import Two from 'two.js';
import { Group } from 'two.js/src/group';
import { Layers } from './TwoController';
import { TopLeftRectangle } from './TopLeftRectangle';
import { Grid } from './types';
import { Coordinate } from '../vis/MapClass';

const CELL_SIZE = 100;
const CELL_STROKE_WIDTH = 10;
const CELL_STROKE_COLOR = '#000000';
const TEXT_SIZE = CELL_SIZE / 4;

// Two.js v0.8.17
export function drawGrid(two: Two, layers: Layers, grid: Grid): Group {
  const layer = layers.map; // write into the map layer

  // (Optional) clear previous map tiles if re-drawing:
  // if (layer.children.length) {
  //   const toRelease = layer.children.slice();
  //   layer.remove(...toRelease);
  //   two.release(...toRelease);
  // }

  // container holding all cells (each cell = sub-Group)
  const cellsGroup = new Group();
  cellsGroup.className = 'cells';
  layer.add(cellsGroup);

  for (let x = 0; x < grid.width; x++) {
    for (let y = 0; y < grid.height; y++) {
      const cellX = x * CELL_SIZE;
      const cellY = y * CELL_SIZE;

      // per-cell group so rect + label move/toggle together
      const cellGroup = new Group();
      cellGroup.className = 'cell';
      // cellGroup.name = `cell:${x},${y}`;
      cellsGroup.add(cellGroup);

      // rectangle (top-left anchored)
      const cell = new TopLeftRectangle(cellX, cellY, CELL_SIZE, CELL_SIZE);
      cell.stroke = CELL_STROKE_COLOR;
      cell.linewidth = CELL_STROKE_WIDTH;
      cell.noFill();
      if (grid.obstacles.has(new Coordinate(x, y).toString())) {
        cell.fill = CELL_STROKE_COLOR;
      }
      cellGroup.add(cell);

      // label (use the *instance* to create text)
      const index = x + y * grid.width;
      const text = two.makeText(
        // String(index),
        `${x},${y}`,
        cellX + CELL_STROKE_WIDTH * 1.5,
        cellY + CELL_STROKE_WIDTH * 2
      );
      text.size = TEXT_SIZE;
      text.alignment = 'left';
      text.className = 'cell-index';
      cellGroup.add(text);
    }
  }

  return cellsGroup;
}
