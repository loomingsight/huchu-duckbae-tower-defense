import { describe, expect, it } from 'vitest';
import { STAGE_1 } from '../../src/game/map/stage1';
import { createGame } from '../../src/game/simulation/createGame';
import { updateGame } from '../../src/game/simulation/updateGame';
import { spawnEnemy } from '../../src/game/simulation/updateWaves';
import { STAGE_1_WAVES } from '../../src/game/waves/stage1Waves';

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

  it('starts the five-second inter-wave delay on the tick that removes the last enemy', () => {
    const state = createGame();
    state.wave.groupIndex = STAGE_1_WAVES[0].groups.length;
    spawnEnemy(state, 'slime', 0);
    state.enemies[0].progress = STAGE_1.pathCells.length - 1;

    updateGame(state, 1);

    expect(state.wave.delayRemaining).toBe(5);
    expect(state.wave.delayActive).toBe(true);
  });

  it('waits exactly five simulation seconds, then advances and spawns the next wave', () => {
    const state = createGame();
    state.wave.groupIndex = STAGE_1_WAVES[0].groups.length;
    spawnEnemy(state, 'slime', 0);
    state.enemies[0].progress = STAGE_1.pathCells.length - 1;
    updateGame(state, 1);

    updateGame(state, 4.999);
    expect(state.wave.index).toBe(0);
    expect(state.wave.delayRemaining).toBeCloseTo(0.001, 8);
    expect(state.enemies).toEqual([]);

    updateGame(state, 0.001);
    expect(state.wave.index).toBe(1);
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0].type).toBe('slime');
  });

  it('does not spawn a new enemy on a tick that ends in defeat', () => {
    const state = createGame();
    state.baseHp = 1;
    spawnEnemy(state, 'slime', 0);
    state.enemies[0].progress = STAGE_1.pathCells.length - 1;

    updateGame(state, 1);

    expect(state.outcome).toBe('defeat');
    expect(state.enemies).toEqual([]);
  });
});
