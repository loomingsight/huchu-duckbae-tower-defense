import { describe, expect, it } from 'vitest';

import { movementDirection } from '../../src/game/render/drawEntities';

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
    expect(movementDirection({ x: 1, y: 0 })).toBe('ne');
    expect(movementDirection({ x: 0, y: 1 })).toBe('se');
    expect(movementDirection({ x: -1, y: 0 })).toBe('sw');
    expect(movementDirection({ x: 0, y: -1 })).toBe('nw');
    expect(movementDirection({ x: 0, y: 0 })).toBe('se');
  });
});
