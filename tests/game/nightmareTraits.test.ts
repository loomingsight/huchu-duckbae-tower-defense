import { describe, expect, it } from 'vitest';

import { updateSlow } from '../../src/game/combat/updateSlow';
import {
  applyEnemyDamage,
  updateEnemyTraits,
} from '../../src/game/enemies/enemyTraits';
import { ENEMY_CATALOG } from '../../src/game/enemies/enemyCatalog';
import { createGame } from '../../src/game/simulation/createGame';
import { updateEnemies } from '../../src/game/simulation/updateEnemies';
import { placeTower } from '../../src/game/simulation/placeTower';
import { spawnEnemy } from '../../src/game/simulation/updateWaves';

describe('nightmare enemy traits', () => {
  it('blocks exactly three damage events before the skeleton takes damage', () => {
    const state = createGame('nightmare-1');
    spawnEnemy(state, 'skeletonKnight', 0);
    const enemy = state.enemies[0];

    for (let hit = 0; hit < 3; hit += 1) applyEnemyDamage(state, enemy, 72);
    expect(enemy.hp).toBe(enemy.maxHp);
    expect(enemy.shieldHitsRemaining).toBe(0);

    applyEnemyDamage(state, enemy, 72);
    expect(enemy.hp).toBe(enemy.maxHp - 72);
    expect(state.traitEvents.map(({ kind }) => kind)).toEqual([
      'shield-open',
      'shield-block',
      'shield-block',
      'shield-break',
      'damage',
    ]);
  });

  it('splits a killed parent once and preserves family reward and score', () => {
    const state = createGame('nightmare-1');
    spawnEnemy(state, 'shadowSlime', 0);
    state.enemies[0].progress = 4;
    state.enemies[0].hp = 0;

    updateEnemies(state, 0);

    expect(state.enemies).toHaveLength(2);
    expect(state.enemies.every(({ variant }) => variant === 'split-child')).toBe(true);
    expect(state.enemies.every(({ maxHp }) => maxHp === 90 * 0.35)).toBe(true);
    expect(state.gold).toBe(283);
    expect(state.stats.combatScore).toBe(15);

    for (const enemy of state.enemies) enemy.hp = 0;
    updateEnemies(state, 0);
    expect(state.enemies).toEqual([]);
    expect(state.gold).toBe(287);
    expect(state.stats.combatScore).toBe(25);
  });

  it('reduces the slow strength by half for vampire bats', () => {
    const state = createGame('nightmare-1');
    placeTower(state, 'slow', { col: 0, row: 6 });
    spawnEnemy(state, 'vampireBat', 0);

    updateSlow(state);

    expect(state.enemies[0].slowMultiplier).toBeCloseTo(0.81);
    expect(state.traitEvents.at(-1)?.kind).toBe('slow-resist');
  });

  it('applies a non-stacking lich aura and enters phase two once on nightmare six', () => {
    const state = createGame('nightmare-6');
    spawnEnemy(state, 'lichKing', 9);
    spawnEnemy(state, 'obsidianGolem', 9);
    const lich = state.enemies[0];
    lich.auraCooldownRemaining = 0;

    updateEnemyTraits(state, 0.1);
    expect(state.enemies[1].auraMultiplier).toBe(1.2);

    lich.hp = lich.maxHp * 0.49;
    updateEnemyTraits(state, 0.1);
    updateEnemyTraits(state, 0.1);
    expect(lich.lichPhase).toBe(2);
    expect(lich.leak).toBe(12);
    expect(state.traitEvents.filter(({ kind }) => kind === 'lich-phase-two')).toHaveLength(1);
  });

  it('applies elite multipliers once at spawn', () => {
    const state = createGame('nightmare-2');

    spawnEnemy(state, 'skeletonKnight', 4, 'elite');

    const enemy = state.enemies[0];
    expect(enemy.variant).toBe('elite');
    expect(enemy.maxHp).toBeCloseTo(ENEMY_CATALOG.skeletonKnight.hp * 1.1 * 1.32 * 1.8);
    expect(enemy.baseSpeed).toBeCloseTo(ENEMY_CATALOG.skeletonKnight.speed * 1.05);
    expect(enemy.reward).toBe(19);
    expect(enemy.combatScore).toBe(140);
  });

  it('emits each obsidian armor crack threshold only once', () => {
    const state = createGame('nightmare-1');
    spawnEnemy(state, 'obsidianGolem', 0);
    const enemy = state.enemies[0];

    enemy.hp = enemy.maxHp * 0.59;
    updateEnemies(state, 0);
    updateEnemies(state, 0);
    enemy.hp = enemy.maxHp * 0.29;
    updateEnemies(state, 0);
    updateEnemies(state, 0);

    expect(enemy.armorStage).toBe(2);
    expect(state.traitEvents.filter(({ kind }) => kind === 'armor-crack')).toHaveLength(2);
  });
});
