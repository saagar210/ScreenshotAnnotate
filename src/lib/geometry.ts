import type { Point } from '../types';

export interface NormalizedRect {
  origin: Point;
  width: number;
  height: number;
}

export function normalizeRectBounds(origin: Point, width: number, height: number): NormalizedRect {
  return {
    origin: {
      x: width < 0 ? origin.x + width : origin.x,
      y: height < 0 ? origin.y + height : origin.y,
    },
    width: Math.abs(width),
    height: Math.abs(height),
  };
}
