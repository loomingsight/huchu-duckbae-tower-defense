import { describe, expect, it } from 'vitest';
import { STAGE_1 } from '../../src/game/map/stage1';

describe('stage 1', () => {
  it('defines the required 20 by 10 grid', () => {
    expect(STAGE_1.width).toBe(20);
    expect(STAGE_1.height).toBe(10);
  });

  it('expands the waypoint route into unique adjacent cells', () => {
    expect(STAGE_1.pathCells).toEqual([
      { col: 0, row: 2 }, { col: 1, row: 2 }, { col: 2, row: 2 },
      { col: 3, row: 2 }, { col: 4, row: 2 }, { col: 5, row: 2 },
      { col: 5, row: 3 }, { col: 5, row: 4 }, { col: 5, row: 5 },
      { col: 5, row: 6 }, { col: 5, row: 7 },
      { col: 6, row: 7 }, { col: 7, row: 7 }, { col: 8, row: 7 },
      { col: 9, row: 7 }, { col: 10, row: 7 }, { col: 11, row: 7 },
      { col: 12, row: 7 },
      { col: 12, row: 6 }, { col: 12, row: 5 }, { col: 12, row: 4 },
      { col: 12, row: 3 },
      { col: 13, row: 3 }, { col: 14, row: 3 }, { col: 15, row: 3 },
      { col: 16, row: 3 }, { col: 17, row: 3 }, { col: 18, row: 3 },
      { col: 19, row: 3 },
    ]);
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
    expect(STAGE_1.isBuildableCell({ col: 1.5, row: 1 }, [])).toBe(false);
    expect(STAGE_1.isBuildableCell({ col: 1, row: Number.NaN }, [])).toBe(false);
    expect(STAGE_1.isBuildableCell({ col: Number.POSITIVE_INFINITY, row: 1 }, [])).toBe(false);
  });
});
