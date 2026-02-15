import { describe, expect, it } from 'vitest';
import { normalizeRectBounds } from './geometry';

describe('normalizeRectBounds', () => {
  it('keeps positive dimensions unchanged', () => {
    const result = normalizeRectBounds({ x: 10, y: 20 }, 30, 40);
    expect(result).toEqual({
      origin: { x: 10, y: 20 },
      width: 30,
      height: 40,
    });
  });

  it('normalizes negative width and height into top-left origin', () => {
    const result = normalizeRectBounds({ x: 100, y: 200 }, -30, -40);
    expect(result).toEqual({
      origin: { x: 70, y: 160 },
      width: 30,
      height: 40,
    });
  });
});
