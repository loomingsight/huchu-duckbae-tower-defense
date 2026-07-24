import { describe, expect, it } from 'vitest';
import { updateProjectiles } from '../../src/game/combat/updateProjectiles';
import { updateSlow } from '../../src/game/combat/updateSlow';
import { updateTowers } from '../../src/game/combat/updateTowers';
import { ENEMY_CATALOG } from '../../src/game/enemies/enemyCatalog';
import { createGame } from '../../src/game/simulation/createGame';
import { placeTower } from '../../src/game/simulation/placeTower';
import { updateGame } from '../../src/game/simulation/updateGame';
import { spawnEnemy } from '../../src/game/simulation/updateWaves';
import { TOWER_CATALOG } from '../../src/game/towers/towerCatalog';

function combatState(type: 'arrow' | 'deokbae' | 'huchu') {
  const state = createGame();
  state.wave.allSpawned = true;
  state.gold = TOWER_CATALOG[type].cost;
  placeTower(state, type, { col: 2, row: 1 });
  return state;
}

describe('tower combat', () => {
  it('makes arrow projectiles damage only their selected target', () => {
    const state = combatState('arrow');
    spawnEnemy(state, 'slime', 0);
    spawnEnemy(state, 'slime', 0);
    state.enemies[0].progress = 2;
    state.enemies[1].progress = 2;

    updateGame(state, 0.2);

    expect(state.enemies[0].hp).toBeCloseTo(ENEMY_CATALOG.slime.hp - 18);
    expect(state.enemies[0].lastHitAtSeconds).toBeCloseTo(0.2);
    expect(state.enemies[1].lastHitAtSeconds).toBeNull();
    expect(state.enemies[1].hp).toBe(ENEMY_CATALOG.slime.hp);
    expect(state.hitEvents).toHaveLength(1);
    expect(state.hitEvents[0]).toMatchObject({ towerType: 'arrow', radius: 0 });
  });

  it.each([
    ['deokbae', 14, 0.85, 0.25],
    ['huchu', 72, 1.25, 0.25],
  ] as const)('%s damages every living enemy inside its impact radius', (type, damage, splash, dt) => {
    const state = combatState(type);
    spawnEnemy(state, 'golem', 0);
    spawnEnemy(state, 'golem', 0);
    spawnEnemy(state, 'golem', 0);
    state.enemies[0].progress = 2;
    state.enemies[1].progress = 2.5;
    state.enemies[2].progress = 6;

    updateGame(state, dt);

    expect(state.enemies.map(({ hp }) => hp)).toEqual([
      ENEMY_CATALOG.golem.hp - damage,
      ENEMY_CATALOG.golem.hp - damage,
      ENEMY_CATALOG.golem.hp,
    ]);
    expect(state.hitEvents[0]).toMatchObject({ towerType: type, radius: splash });
  });

  it.each([
    ['deokbae', 14, 0.85],
    ['huchu', 72, 1.25],
  ] as const)(
    '%s projectile disrupts an N3 counter shield before dealing damage',
    (type, damage, splash) => {
      const state = createGame('nightmare-3');
      spawnEnemy(state, 'skeletonKnight', 0);
      const enemy = state.enemies[0];
      state.projectiles.push({
        id: 1,
        towerType: type,
        position: { x: 0.5, y: 8.5 },
        targetId: enemy.id,
        damage,
        speed: TOWER_CATALOG[type].projectileSpeed ?? 0,
        splash,
      });

      updateProjectiles(state, 1 / 60);

      expect(enemy.shieldHitsRemaining).toBe(0);
      expect(enemy.hp).toBe(enemy.maxHp);
      expect(state.traitEvents.at(-1)?.kind).toBe('shield-break');
    },
  );

  it('gives each reward once when one splash kills multiple enemies', () => {
    const state = combatState('huchu');
    spawnEnemy(state, 'fairy', 0);
    spawnEnemy(state, 'fairy', 0);
    state.enemies[0].progress = 2;
    state.enemies[1].progress = 2.5;

    updateGame(state, 0.2);
    updateGame(state, 0.2);

    expect(state.enemies).toEqual([]);
    expect(state.gold).toBe(20);
  });

  it('applies the non-stacking slow aura before enemy movement and deals zero damage', () => {
    const state = createGame();
    state.wave.allSpawned = true;
    placeTower(state, 'slow', { col: 0, row: 1 });
    placeTower(state, 'slow', { col: 1, row: 1 });
    spawnEnemy(state, 'slime', 0);

    updateGame(state, 1);

    expect(state.enemies[0].slowMultiplier).toBe(0.62);
    expect(state.enemies[0].progress).toBeCloseTo(1.15 * 0.62);
    expect(state.enemies[0].hp).toBe(ENEMY_CATALOG.slime.hp);
    expect(state.projectiles).toEqual([]);
  });

  it('restores normal speed when an enemy leaves all slow auras', () => {
    const state = createGame();
    state.wave.allSpawned = true;
    placeTower(state, 'slow', { col: 0, row: 1 });
    spawnEnemy(state, 'slime', 0);
    state.enemies[0].slowMultiplier = 0.62;
    state.enemies[0].progress = 10;

    updateGame(state, 1);

    expect(state.enemies[0].slowMultiplier).toBe(1);
    expect(state.enemies[0].progress).toBeCloseTo(11.15);
  });

  it('includes the exact slow boundary and excludes an enemy just beyond it', () => {
    const state = createGame();
    placeTower(state, 'slow', { col: 4, row: 3 });
    spawnEnemy(state, 'slime', 0);
    spawnEnemy(state, 'slime', 0);
    const boundaryProgress = 6 + Math.sqrt(2.4 ** 2 - 1);
    state.enemies[0].progress = boundaryProgress;
    state.enemies[1].progress = boundaryProgress + 0.0001;

    updateSlow(state);

    expect(state.enemies.map(({ slowMultiplier }) => slowMultiplier)).toEqual([0.62, 1]);
  });

  it('removes a projectile without impact when its target has already died', () => {
    const state = createGame();
    spawnEnemy(state, 'slime', 0);
    state.enemies[0].hp = 0;
    state.projectiles.push({
      id: 1,
      towerType: 'arrow',
      position: { x: 0.5, y: 1.5 },
      targetId: state.enemies[0].id,
      damage: 18,
      speed: 8,
      splash: 0,
    });

    updateProjectiles(state, 1);

    expect(state.projectiles).toEqual([]);
    expect(state.hitEvents).toEqual([]);
  });

  it('removes a projectile whose target id does not exist', () => {
    const state = createGame();
    state.projectiles.push({
      id: 1,
      towerType: 'arrow',
      position: { x: 0.5, y: 1.5 },
      targetId: 999,
      damage: 18,
      speed: 8,
      splash: 0,
    });

    updateProjectiles(state, 1 / 60);

    expect(state.projectiles).toEqual([]);
  });

  it('removes an earlier flying projectile when a later splash removes its target', () => {
    const state = createGame();
    state.wave.allSpawned = true;
    spawnEnemy(state, 'fairy', 0);
    spawnEnemy(state, 'fairy', 0);
    state.enemies[0].progress = 2;
    state.enemies[1].progress = 2.5;
    state.projectiles.push(
      {
        id: 1,
        towerType: 'arrow',
        position: { x: 0.5, y: 2.5 },
        targetId: state.enemies[0].id,
        damage: 18,
        speed: 0.1,
        splash: 0,
      },
      {
        id: 2,
        towerType: 'huchu',
        position: { x: 3, y: 2.5 },
        targetId: state.enemies[1].id,
        damage: 72,
        speed: 5,
        splash: 1.25,
      },
    );

    updateGame(state, 1 / 60);

    expect(state.enemies).toEqual([]);
    expect(state.projectiles).toEqual([]);
    expect(state.outcome).toBe('victory');
  });

  it('includes the exact splash boundary and excludes an enemy just beyond it', () => {
    const state = createGame();
    spawnEnemy(state, 'golem', 0);
    spawnEnemy(state, 'golem', 0);
    spawnEnemy(state, 'golem', 0);
    state.enemies[0].progress = 2;
    state.enemies[1].progress = 2 + 0.85;
    state.enemies[2].progress = 2 + 0.8501;
    state.projectiles.push({
      id: 1,
      towerType: 'deokbae',
      position: { x: 2.5, y: 2.5 },
      targetId: state.enemies[0].id,
      damage: 14,
      speed: 6.5,
      splash: 0.85,
    });

    updateProjectiles(state, 1 / 60);

    expect(state.enemies.map(({ hp }) => hp)).toEqual([
      ENEMY_CATALOG.golem.hp - 14,
      ENEMY_CATALOG.golem.hp - 14,
      ENEMY_CATALOG.golem.hp,
    ]);
  });

  it.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])('clears stale hit events when projectile dt is %s', (dt) => {
    const state = createGame();
    state.hitEvents.push({
      kind: 'hit',
      towerType: 'arrow',
      position: { x: 1.5, y: 1.5 },
      radius: 0,
    });

    updateProjectiles(state, dt);

    expect(state.hitEvents).toEqual([]);
  });

  it.each(['victory', 'defeat'] as const)('clears stale hit events after %s', (outcome) => {
    const state = createGame();
    state.outcome = outcome;
    state.hitEvents.push({
      kind: 'hit',
      towerType: 'huchu',
      position: { x: 2.5, y: 2.5 },
      radius: 1.25,
    });

    updateGame(state, 1 / 60);

    expect(state.hitEvents).toEqual([]);
  });

  it.each([
    ['arrow', 4],
    ['deokbae', 6],
    ['huchu', 2],
  ] as const)('preserves %s cooldown cadence across fixed-step cycles', (type, expectedShots) => {
    const state = combatState(type);
    spawnEnemy(state, 'minotaur', 0);
    state.enemies[0].progress = 2;

    for (let step = 0; step < 127; step += 1) {
      updateTowers(state, 1 / 60);
    }

    expect(state.projectiles).toHaveLength(expectedShots);
  });

  it('does not advance combat for invalid or non-positive elapsed time', () => {
    const state = combatState('arrow');
    spawnEnemy(state, 'slime', 0);
    state.enemies[0].progress = 2;

    updateGame(state, Number.NaN);
    updateGame(state, Number.POSITIVE_INFINITY);
    updateGame(state, -1);
    updateGame(state, 0);

    expect(state.enemies[0].hp).toBe(ENEMY_CATALOG.slime.hp);
    expect(state.enemies[0].progress).toBe(2);
    expect(state.projectiles).toEqual([]);
  });
});
