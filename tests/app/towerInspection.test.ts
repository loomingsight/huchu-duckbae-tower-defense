import { describe, expect, it } from 'vitest';

import { towerAtCell, towerById } from '../../src/app/towerInspection';
import { createGame } from '../../src/game/simulation/createGame';
import { placeTower } from '../../src/game/simulation/placeTower';

describe('installed tower lookup', () => {
  it('finds towers by exact cell or stable ID', () => {
    const state = createGame();
    placeTower(state, 'arrow', { col: 4, row: 1 });
    const tower = state.towers[0];

    expect(towerAtCell(state.towers, { col: 4, row: 1 })).toBe(tower);
    expect(towerAtCell(state.towers, { col: 5, row: 1 })).toBeNull();
    expect(towerById(state.towers, tower.id)).toBe(tower);
    expect(towerById(state.towers, 999)).toBeNull();
  });
});
