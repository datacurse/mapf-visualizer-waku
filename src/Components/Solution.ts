import { Coordinate } from './Map';

export enum Orientation {
  NONE,
  X_MINUS,
  X_PLUS,
  Y_MINUS,
  Y_PLUS
}

export function orientationToRotation(orientation: Orientation): number {
  switch (orientation) {
    case Orientation.NONE: return 0;
    case Orientation.X_MINUS: return Math.PI;
    case Orientation.X_PLUS: return 0;
    case Orientation.Y_MINUS: return -Math.PI / 2;
    case Orientation.Y_PLUS: return Math.PI / 2;
  }
}

function orientationFromString(orientationString: string | undefined): Orientation {
  switch (orientationString) {
    case "X_MINUS": return Orientation.X_MINUS;
    case "X_PLUS": return Orientation.X_PLUS;
    case "Y_MINUS": return Orientation.Y_MINUS;
    case "Y_PLUS": return Orientation.Y_PLUS;
    default: return Orientation.NONE;
  }
}

export class Pose {
  public position: Coordinate = new Coordinate(0, 0);
  public orientation: Orientation = Orientation.NONE;

  constructor(position: Coordinate = new Coordinate(0, 0), orientation: Orientation = Orientation.NONE) {
    this.position = position;
    this.orientation = orientation;
  }
}

export type Solution = Pose[][];

export function parseSolution(text: string): Solution {
  return text
    .trim()
    .split(/\r?\n/)
    .map(lineString => {
      // 0:(18,26),(29,21),(18,24),
      const poseStrings = lineString.match(/\(([^)]*)\)/g) || []; // [(18,26), (29,21), (18,24)]
      console.log(poseStrings)
      const linePoses = poseStrings.map(poseString => { // (18,26)
        const innerString = poseString.slice(1, -1); // 18,26
        const [xNumber, yNumber, orientation] = innerString
          .split(",") // [18, 26]
          .map((partString, partIndex) => {
            switch (partIndex) {
              case 0: return Number(partString);
              case 1: return Number(partString);
              case 2: return orientationFromString(partString);
              default: throw new Error(`Unexpected extra part in pose string: "${partString}"`);
            }
          }) as [number, number, Orientation];
        return new Pose(new Coordinate(xNumber, yNumber), orientation);
      });
      if (linePoses.length === 0) throw new Error("Invalid solution");
      return linePoses;
    });
}
