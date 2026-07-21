import { describe, expect, it } from 'vitest';

import { movementDirection } from '../../src/game/render/drawEntities';
import { arrowFrameForScreenVector } from '../../src/game/render/drawEffects';

describe('movementDirection', () => {
  it.each([
    [{ x: 1, y: -1 }, 'ne'],
    [{ x: 1, y: 1 }, 'se'],
    [{ x: -1, y: 1 }, 'sw'],
    [{ x: -1, y: -1 }, 'nw'],
  ] as const)('maps vector %o to %s in game coordinates', (vector, expected) => {
    expect(movementDirection(vector)).toBe(expected);
  });

  it('uses deterministic diagonal directions for axis-aligned and zero vectors', () => {
    expect(movementDirection({ x: 1, y: 0 })).toBe('se');
    expect(movementDirection({ x: 0, y: 1 })).toBe('sw');
    expect(movementDirection({ x: -1, y: 0 })).toBe('nw');
    expect(movementDirection({ x: 0, y: -1 })).toBe('ne');
    expect(movementDirection({ x: 0, y: 0 })).toBe('se');
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
