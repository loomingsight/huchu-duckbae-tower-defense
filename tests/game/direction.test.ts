import { describe, expect, it } from 'vitest';

import { screenDiagonalDirection } from '../../src/game/render/drawEntities';
import { arrowFrameForScreenVector } from '../../src/game/render/drawEffects';

describe('screenDiagonalDirection', () => {
  it.each([
    [{ x: 1, y: -1 }, 'ne'],
    [{ x: 1, y: 1 }, 'se'],
    [{ x: -1, y: 1 }, 'sw'],
    [{ x: -1, y: -1 }, 'nw'],
  ] as const)('maps screen vector %o to %s', (vector, expected) => {
    expect(screenDiagonalDirection(vector)).toBe(expected);
  });

  it('uses deterministic diagonals for axis-aligned and zero vectors', () => {
    expect(screenDiagonalDirection({ x: 1, y: 0 })).toBe('se');
    expect(screenDiagonalDirection({ x: 0, y: 1 })).toBe('sw');
    expect(screenDiagonalDirection({ x: -1, y: 0 })).toBe('nw');
    expect(screenDiagonalDirection({ x: 0, y: -1 })).toBe('ne');
    expect(screenDiagonalDirection({ x: 0, y: 0 })).toBe('se');
  });
});

describe('arrowFrameForScreenVector', () => {
  it.each([
    [{ x: 1, y: 0 }, 0],
    [{ x: 1, y: 1 }, 1],
    [{ x: 0, y: 1 }, 2],
    [{ x: -1, y: 1 }, 3],
    [{ x: -1, y: 0 }, 4],
    [{ x: -1, y: -1 }, 5],
    [{ x: 0, y: -1 }, 6],
    [{ x: 1, y: -1 }, 7],
  ] as const)('selects sprite frame %s for %o', (vector, frame) => {
    expect(arrowFrameForScreenVector(vector)).toBe(frame);
  });
});
