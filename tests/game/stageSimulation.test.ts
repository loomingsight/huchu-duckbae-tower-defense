import { describe, expect, it } from 'vitest';
import { enemyPosition } from '../../src/game/combat/targeting';
import { cellCenter } from '../../src/game/core/geometry';
import { ENEMY_CATALOG } from '../../src/game/enemies/enemyCatalog';
import { getStageDefinition } from '../../src/game/stages/stageCatalog';
import { createGame, INITIAL_GOLD } from '../../src/game/simulation/createGame';
import { updateEnemies } from '../../src/game/simulation/updateEnemies';
import { placeTower } from '../../src/game/simulation/placeTower';
import { spawnEnemy, updateWaves } from '../../src/game/simulation/updateWaves';

describe('stage-aware simulation', () => {
  it('starts every stage with fresh resources and normalizes invalid ids', () => {
    for (const stageId of [1, 2, 3, 4, 5, 6] as const) {
      const state = createGame(stageId);

      expect(state).toMatchObject({
        stageId,
        gold: INITIAL_GOLD,
        baseHp: 20,
        towers: [],
      });
    }

    expect(createGame(99).stageId).toBe(1);
  });

  it('applies the stage and wave HP multipliers exactly once', () => {
    const state = createGame(6);
    spawnEnemy(state, 'minotaur', 9);

    const expectedHp = ENEMY_CATALOG.minotaur.hp * 1.52 * 1.72;
    expect(state.enemies[0].maxHp).toBeCloseTo(expectedHp);
    expect(state.enemies[0].hp).toBeCloseTo(expectedHp);
  });

  it('applies stage speed and leaks at the selected route endpoint', () => {
    const state = createGame(6);
    const stage = getStageDefinition(6);
    spawnEnemy(state, 'slime', 0);

    updateEnemies(state, 1);
    expect(state.enemies[0].progress).toBeCloseTo(ENEMY_CATALOG.slime.speed * 1.08);

    state.enemies[0].progress = stage.map.pathCells.length - 1;
    updateEnemies(state, 0);
    expect(state.enemies).toEqual([]);
    expect(state.baseHp).toBe(19);
  });

  it('applies the selected stage spawn interval multiplier', () => {
    const state = createGame(6);

    updateWaves(state, 0.01);

    expect(state.enemies).toHaveLength(1);
    expect(state.wave.spawnCooldown).toBeCloseTo((0.70 * 0.92) - 0.01);
  });

  it('uses the selected map for placement and targeting coordinates', () => {
    const state = createGame(2);

    expect(placeTower(state, 'arrow', { col: 2, row: 7 })).toEqual({
      ok: false,
      reason: 'not-buildable',
    });
    expect(placeTower(state, 'arrow', { col: 2, row: 6 })).toEqual({ ok: true });

    spawnEnemy(state, 'slime', 0);
    const stage6 = getStageDefinition(6);
    const enemy = state.enemies[0];
    enemy.progress = stage6.map.pathCells.length - 1;
    expect(enemyPosition(enemy, 6)).toEqual(cellCenter(stage6.map.pathCells.at(-1)!));
  });
});
