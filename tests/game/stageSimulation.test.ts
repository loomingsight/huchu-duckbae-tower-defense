import { describe, expect, it } from 'vitest';
import { enemyPosition } from '../../src/game/combat/targeting';
import { cellCenter } from '../../src/game/core/geometry';
import { ENEMY_CATALOG } from '../../src/game/enemies/enemyCatalog';
import { getStageDefinition } from '../../src/game/stages/stageCatalog';
import { createGame } from '../../src/game/simulation/createGame';
import { updateEnemies } from '../../src/game/simulation/updateEnemies';
import { placeTower } from '../../src/game/simulation/placeTower';
import { spawnEnemy, updateWaves } from '../../src/game/simulation/updateWaves';

describe('stage-aware simulation', () => {
  it('starts every normal stage with fresh resources and normalizes invalid keys', () => {
    for (const stageNumber of [1, 2, 3, 4, 5, 6] as const) {
      const stageKey = `normal-${stageNumber}` as const;
      const state = createGame(stageKey);

      expect(state).toMatchObject({
        stageKey,
        gold: 320,
        baseHp: 20,
        towers: [],
      });
    }

    expect(createGame('nightmare-3')).toMatchObject({
      stageKey: 'nightmare-3',
      gold: 360,
      baseHp: 12,
    });
    expect(createGame(99).stageKey).toBe('normal-1');
  });

  it('applies the stage and wave HP multipliers exactly once', () => {
    const state = createGame('normal-6');
    const stage = getStageDefinition('normal-6');
    spawnEnemy(state, 'minotaur', 9);

    const expectedHp = ENEMY_CATALOG.minotaur.hp
      * stage.hpMultiplier
      * (1 + 9 * stage.waveHpGrowth);
    expect(state.enemies[0].maxHp).toBeCloseTo(expectedHp);
    expect(state.enemies[0].hp).toBeCloseTo(expectedHp);
  });

  it('applies stage speed and leaks at the selected route endpoint', () => {
    const state = createGame('normal-6');
    const stage = getStageDefinition('normal-6');
    spawnEnemy(state, 'slime', 0);

    updateEnemies(state, 1);
    expect(state.enemies[0].progress).toBeCloseTo(ENEMY_CATALOG.slime.speed * 1.08);

    state.enemies[0].progress = stage.map.pathCells.length - 1;
    updateEnemies(state, 0);
    expect(state.enemies).toEqual([]);
    expect(state.baseHp).toBe(19);
  });

  it('applies the selected stage spawn interval multiplier', () => {
    const state = createGame('normal-6');

    updateWaves(state, 0.01);

    expect(state.enemies).toHaveLength(1);
    expect(state.wave.spawnCooldown).toBeCloseTo((0.70 * 0.92) - 0.01);
  });

  it('uses the selected stage inter-wave delay', () => {
    const state = createGame('nightmare-2');
    const stage = getStageDefinition('nightmare-2');
    state.wave.groupIndex = stage.waves[0].groups.length;
    state.enemies = [];

    updateWaves(state, 0.01);

    expect(state.wave.delayActive).toBe(true);
    expect(state.wave.delayRemaining)
      .toBeCloseTo(stage.interWaveDelaySeconds - 0.01);
  });

  it('uses the selected map for placement and targeting coordinates', () => {
    const state = createGame('normal-2');

    expect(placeTower(state, 'arrow', { col: 2, row: 7 })).toEqual({
      ok: false,
      reason: 'not-buildable',
    });
    expect(placeTower(state, 'arrow', { col: 2, row: 6 })).toEqual({ ok: true });

    spawnEnemy(state, 'slime', 0);
    const stage6 = getStageDefinition('normal-6');
    const enemy = state.enemies[0];
    enemy.progress = stage6.map.pathCells.length - 1;
    expect(enemyPosition(enemy, 'normal-6')).toEqual(cellCenter(stage6.map.pathCells.at(-1)!));
  });
});
