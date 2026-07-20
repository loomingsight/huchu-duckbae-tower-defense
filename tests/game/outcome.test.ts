import { describe, expect, it } from 'vitest';
import { STAGE_1 } from '../../src/game/map/stage1';
import { createGame } from '../../src/game/simulation/createGame';
import { updateGame } from '../../src/game/simulation/updateGame';
import { spawnEnemy } from '../../src/game/simulation/updateWaves';

describe('base damage and game outcomes', () => {
  it('reduces base HP by the exiting enemy leak damage', () => {
    const state = createGame();
    state.wave.allSpawned = true;
    spawnEnemy(state, 'orc', 0);
    state.enemies[0].progress = STAGE_1.pathCells.length - 1;

    updateGame(state, 1);

    expect(state.baseHp).toBe(18);
    expect(state.enemies).toEqual([]);
  });

  it('sets defeat when a leak reduces base HP to zero', () => {
    const state = createGame();
    state.baseHp = 1;
    state.wave.allSpawned = true;
    spawnEnemy(state, 'slime', 0);
    state.enemies[0].progress = STAGE_1.pathCells.length - 1;

    updateGame(state, 1);

    expect(state.baseHp).toBe(0);
    expect(state.outcome).toBe('defeat');
  });

  it('sets victory after the final wave has spawned and no enemy remains', () => {
    const state = createGame();
    state.wave.index = 9;
    state.wave.allSpawned = true;

    updateGame(state, 0);

    expect(state.outcome).toBe('victory');
  });
});
