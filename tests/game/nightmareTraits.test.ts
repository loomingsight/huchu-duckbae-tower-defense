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
import { spawnEnemy, updateWaves } from '../../src/game/simulation/updateWaves';
import { getStageDefinition } from '../../src/game/stages/stageCatalog';
import { TOWER_CATALOG } from '../../src/game/towers/towerCatalog';

describe('nightmare enemy traits', () => {
  it('announces the split trait when a shadow slime first appears', () => {
    const state = createGame('nightmare-1');

    spawnEnemy(state, 'shadowSlime', 0);

    expect(state.traitEvents.at(-1)?.kind).toBe('split-open');
  });

  it('applies the early wave kill value multiplier to the parent once', () => {
    const state = createGame('nightmare-1');

    updateWaves(state, 0.01);

    expect(state.enemies[0]).toMatchObject({
      type: 'shadowSlime',
      reward: 5,
      combatScore: 24,
    });

    const direct = createGame('nightmare-1');
    spawnEnemy(direct, 'shadowSlime', 0, 'standard', Number.NaN);
    expect(direct.enemies[0]).toMatchObject({
      reward: 3,
      combatScore: 15,
    });
  });

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

  it('keeps the N3 counter shield locked against arrows', () => {
    const state = createGame('nightmare-3');
    spawnEnemy(state, 'skeletonKnight', 0);
    const enemy = state.enemies[0];

    for (let hit = 0; hit < 6; hit += 1) {
      applyEnemyDamage(state, enemy, 18, 'arrow');
    }

    expect(enemy.hp).toBe(enemy.maxHp);
    expect(enemy.shieldHitsRemaining).toBe(3);
    expect(state.traitEvents.filter(({ kind }) => kind === 'shield-block'))
      .toHaveLength(6);
  });

  it('keeps the N2 three-hit shield compatible with arrow damage', () => {
    const state = createGame('nightmare-2');
    spawnEnemy(state, 'skeletonKnight', 0);
    const enemy = state.enemies[0];

    applyEnemyDamage(state, enemy, 18, 'arrow');

    expect(enemy.hp).toBe(enemy.maxHp);
    expect(enemy.shieldHitsRemaining).toBe(2);
  });

  it('lets a slow tower disrupt the N3 counter shield once', () => {
    const state = createGame('nightmare-3');
    placeTower(state, 'slow', { col: 0, row: 7 });
    spawnEnemy(state, 'skeletonKnight', 0);

    updateSlow(state);
    updateSlow(state);

    expect(state.enemies[0].shieldHitsRemaining).toBe(0);
    expect(state.traitEvents.filter(({ kind }) => kind === 'shield-break'))
      .toHaveLength(1);
  });

  it.each(['deokbae', 'huchu'] as const)(
    'lets %s consume its first hit to disrupt the N3 counter shield',
    (type) => {
      const state = createGame('nightmare-3');
      spawnEnemy(state, 'skeletonKnight', 0);
      const enemy = state.enemies[0];

      applyEnemyDamage(state, enemy, 72, type);

      expect(enemy.shieldHitsRemaining).toBe(0);
      expect(enemy.hp).toBe(enemy.maxHp);

      applyEnemyDamage(state, enemy, 72, type);

      expect(enemy.hp).toBe(enemy.maxHp - 72);
    },
  );

  it('splits a killed parent once and preserves family reward and score', () => {
    const state = createGame('nightmare-1');
    spawnEnemy(state, 'shadowSlime', 0);
    state.enemies[0].progress = 4;
    state.enemies[0].hp = 0;

    updateEnemies(state, 0);

    expect(state.enemies).toHaveLength(2);
    expect(state.enemies.every(({ variant }) => variant === 'split-child')).toBe(true);
    expect(state.enemies.every(({ maxHp }) => maxHp === 72 * 0.17)).toBe(true);
    expect(state.gold).toBe(283);
    expect(state.stats.combatScore).toBe(15);

    for (const enemy of state.enemies) enemy.hp = 0;
    updateEnemies(state, 0);
    expect(state.enemies).toEqual([]);
    expect(state.gold).toBe(287);
    expect(state.stats.combatScore).toBe(25);
  });

  it('lets the starter arrow tower clear one N1 slime family in six hits', () => {
    const state = createGame('nightmare-1');
    const arrowDamage = TOWER_CATALOG.arrow.damage ?? 0;
    spawnEnemy(state, 'shadowSlime', 0);
    const parent = state.enemies[0];

    expect(parent.maxHp).toBe(72);
    for (let hit = 0; hit < 4; hit += 1) {
      applyEnemyDamage(state, parent, arrowDamage);
    }
    updateEnemies(state, 0);

    expect(state.enemies).toHaveLength(2);
    expect(state.enemies.every(({ maxHp }) => maxHp <= arrowDamage)).toBe(true);
    for (const child of state.enemies) {
      applyEnemyDamage(state, child, arrowDamage);
    }
    updateEnemies(state, 0);

    expect(state.enemies).toEqual([]);
  });

  it('keeps the approved early child arrow-hit curve across nightmare stages', () => {
    const arrowDamage = TOWER_CATALOG.arrow.damage ?? 0;
    const expectedHits = [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 2],
    ] as const;

    for (const [stageIndex, stageNumber] of (
      [1, 2, 3, 4, 5, 6] as const
    ).entries()) {
      for (const waveIndex of [0, 1, 2] as const) {
        const state = createGame(`nightmare-${stageNumber}`);
        spawnEnemy(state, 'shadowSlime', waveIndex);
        state.enemies[0].hp = 0;

        updateEnemies(state, 0);

        expect(state.enemies).toHaveLength(2);
        expect(Math.ceil(state.enemies[0].maxHp / arrowDamage))
          .toBe(expectedHits[stageIndex][waveIndex]);
      }
    }
  });

  it('preserves early family gold and score without boosting late families', () => {
    const early = createGame('nightmare-1');
    spawnEnemy(early, 'shadowSlime', 0, 'standard', 1.6);
    early.enemies[0].hp = 0;
    updateEnemies(early, 0);
    for (const child of early.enemies) child.hp = 0;
    updateEnemies(early, 0);

    expect(early.gold).toBe(289);
    expect(early.stats.combatScore).toBe(34);

    const late = createGame('nightmare-1');
    spawnEnemy(late, 'shadowSlime', 3);
    late.enemies[0].hp = 0;
    updateEnemies(late, 0);
    for (const child of late.enemies) child.hp = 0;
    updateEnemies(late, 0);

    expect(late.gold).toBe(287);
    expect(late.stats.combatScore).toBe(25);
  });

  it('reduces the slow strength by half for vampire bats', () => {
    const state = createGame('nightmare-1');
    placeTower(state, 'slow', { col: 0, row: 6 });
    spawnEnemy(state, 'vampireBat', 0);

    updateSlow(state);

    expect(state.enemies[0].slowMultiplier).toBeCloseTo(0.81);
    expect(state.traitEvents.at(-1)?.kind).toBe('slow-resist');
  });

  it('makes obsidian golems fast enough to reward slow coverage', () => {
    const expectedTravelSeconds = [57.7, 51.9, 47.6, 49.0, 44.8, 42.1] as const;

    for (const [index, stageNumber] of (
      [1, 2, 3, 4, 5, 6] as const
    ).entries()) {
      const state = createGame(`nightmare-${stageNumber}`);
      const stage = getStageDefinition(state.stageKey);
      spawnEnemy(state, 'obsidianGolem', 5);

      updateEnemies(state, 1);

      const effectiveSpeed = 0.52 * stage.speedMultiplier;
      expect(state.enemies[0].progress).toBeCloseTo(effectiveSpeed);
      expect((stage.map.pathCells.length - 1) / effectiveSpeed)
        .toBeCloseTo(expectedTravelSeconds[index], 1);
    }

    const slowed = createGame('nightmare-1');
    placeTower(slowed, 'slow', { col: 0, row: 6 });
    spawnEnemy(slowed, 'obsidianGolem', 5);

    updateSlow(slowed);
    updateEnemies(slowed, 1);

    expect(slowed.enemies[0].progress).toBeCloseTo(0.52 * 0.62);
    expect(slowed.enemies[0]).toMatchObject({
      maxHp: 620 * (1 + 5 * 0.08),
      reward: 24,
      leak: 3,
    });
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
    const stage = getStageDefinition(state.stageKey);
    expect(enemy.variant).toBe('elite');
    expect(enemy.maxHp).toBeCloseTo(
      ENEMY_CATALOG.skeletonKnight.hp
      * stage.hpMultiplier
      * (1 + 4 * stage.waveHpGrowth)
      * 1.8,
    );
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
