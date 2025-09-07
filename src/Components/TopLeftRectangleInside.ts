import { Rectangle } from 'two.js/src/shapes/rectangle';

export class TopLeftRectangleInside extends Rectangle {
  constructor(x: number, y: number, width: number, height: number, border: number = 0) {
    const s = Math.max(0, border);
    super(
      x + width / 2,
      y + height / 2,
      Math.max(0, width - s),
      Math.max(0, height - s)
    );
    this.linewidth = s;
  }
}
