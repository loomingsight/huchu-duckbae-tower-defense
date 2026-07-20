import { describe, expect, it } from 'vitest';
import { cellCenter, worldToCell } from '../../src/game/core/geometry';

describe('grid geometry', () => {
  it('returns the world-space center of a cell', () => {
    expect(cellCenter({ col: 3, row: 4 })).toEqual({ x: 3.5, y: 4.5 });
  });

  it('maps a world position to its containing cell', () => {
    expect(worldToCell({ x: 3.99, y: 4.01 })).toEqual({ col: 3, row: 4 });
  });
});
