import { Rectangle } from 'two.js/src/shapes/rectangle';

export class TopLeftRectangle extends Rectangle {
  constructor(x: number, y: number, width: number, height: number) {
    super(x + width / 2, y + height / 2, width, height);
  }
}
