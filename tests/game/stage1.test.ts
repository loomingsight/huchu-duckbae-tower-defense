import { describe, expect, it } from 'vitest';
import { STAGE_1 } from '../../src/game/map/stage1';

describe('stage 1', () => {
  it('defines the required 20 by 10 grid', () => {
    expect(STAGE_1.width).toBe(20);
    expect(STAGE_1.height).toBe(10);
  });

  it('expands the waypoint route into unique adjacent cells', () => {
    expect(STAGE_1.pathCells[0]).toEqual({ col: 0, row: 2 });
    expect(STAGE_1.pathCells.at(-1)).toEqual({ col: 19, row: 3 });
    expect(STAGE_1.pathCells.every((cell, index, all) => (
      index === 0
      || Math.abs(cell.col - all[index - 1].col) + Math.abs(cell.row - all[index - 1].row) === 1
    ))).toBe(true);
    expect(new Set(STAGE_1.pathCells.map(({ col, row }) => `${col}:${row}`)).size)
      .toBe(STAGE_1.pathCells.length);
  });

  it('allows construction only on in-bounds, unoccupied non-path cells', () => {
    expect(STAGE_1.isBuildableCell({ col: 1, row: 1 }, [])).toBe(true);
    expect(STAGE_1.isBuildableCell({ col: 0, row: 2 }, [])).toBe(false);
    expect(STAGE_1.isBuildableCell({ col: 1, row: 1 }, [{ col: 1, row: 1 }])).toBe(false);
    expect(STAGE_1.isBuildableCell({ col: 20, row: 1 }, [])).toBe(false);
  });
});
