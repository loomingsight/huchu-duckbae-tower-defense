import { describe, expect, it } from 'vitest';
import { selectTarget } from '../../src/game/combat/targeting';
import { createGame, type GameEnemy, type GameTower } from '../../src/game/simulation/createGame';
import { placeTower } from '../../src/game/simulation/placeTower';
import { spawnEnemy } from '../../src/game/simulation/updateWaves';

function enemy(id: number, progress: number, hp = 42): GameEnemy {
  return {
    id,
    type: 'slime',
    hp,
    maxHp: 42,
    progress,
    speedMultiplier: 1,
    rewarded: false,
  };
}

describe('tower targeting', () => {
  it('selects the living in-range enemy with the highest route progress', () => {
    const state = createGame();
    placeTower(state, 'arrow', { col: 3, row: 1 });
    const tower = state.towers[0] as GameTower;
    const behindEnemy = enemy(1, 1);
    const aheadEnemy = enemy(2, 4);

    expect(selectTarget(tower, [behindEnemy, aheadEnemy])?.id).toBe(aheadEnemy.id);
  });

  it('ignores dead and out-of-range enemies', () => {
    const state = createGame();
    placeTower(state, 'arrow', { col: 0, row: 1 });
    const tower = state.towers[0] as GameTower;

    expect(selectTarget(tower, [enemy(1, 0, 0), enemy(2, 12)])).toBeUndefined();
  });

  it('breaks equal-progress ties deterministically by enemy id', () => {
    const state = createGame();
    placeTower(state, 'arrow', { col: 2, row: 1 });
    spawnEnemy(state, 'slime', 0);
    spawnEnemy(state, 'slime', 0);
    state.enemies[0].progress = 2;
    state.enemies[1].progress = 2;

    expect(selectTarget(state.towers[0], [state.enemies[1], state.enemies[0]])?.id).toBe(1);
  });
});
