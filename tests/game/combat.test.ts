import { describe, expect, it } from 'vitest';
import { updateProjectiles } from '../../src/game/combat/updateProjectiles';
import { createGame } from '../../src/game/simulation/createGame';
import { placeTower } from '../../src/game/simulation/placeTower';
import { updateGame } from '../../src/game/simulation/updateGame';
import { spawnEnemy } from '../../src/game/simulation/updateWaves';

function combatState(type: 'arrow' | 'deokbae' | 'huchu') {
  const state = createGame();
  state.wave.allSpawned = true;
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

    expect(state.enemies[0].hp).toBe(24);
    expect(state.enemies[1].hp).toBe(42);
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

    expect(state.enemies.map(({ hp }) => hp)).toEqual([320 - damage, 320 - damage, 320]);
    expect(state.hitEvents[0]).toMatchObject({ towerType: type, radius: splash });
  });

  it('gives each reward once when one splash kills multiple enemies', () => {
    const state = combatState('huchu');
    spawnEnemy(state, 'fairy', 0);
    spawnEnemy(state, 'fairy', 0);
    state.enemies[0].progress = 2;
    state.enemies[1].progress = 2.5;

    updateGame(state, 0.2);
    updateGame(state, 0.2);

    expect(state.enemies).toEqual([]);
    expect(state.gold).toBe(178);
  });

  it('applies the non-stacking slow aura before enemy movement and deals zero damage', () => {
    const state = createGame();
    state.wave.allSpawned = true;
    placeTower(state, 'slow', { col: 0, row: 1 });
    placeTower(state, 'slow', { col: 1, row: 1 });
    spawnEnemy(state, 'slime', 0);

    updateGame(state, 1);

    expect(state.enemies[0].speedMultiplier).toBe(0.62);
    expect(state.enemies[0].progress).toBeCloseTo(1.15 * 0.62);
    expect(state.enemies[0].hp).toBe(42);
    expect(state.projectiles).toEqual([]);
  });

  it('restores normal speed when an enemy leaves all slow auras', () => {
    const state = createGame();
    state.wave.allSpawned = true;
    placeTower(state, 'slow', { col: 0, row: 1 });
    spawnEnemy(state, 'slime', 0);
    state.enemies[0].speedMultiplier = 0.62;
    state.enemies[0].progress = 10;

    updateGame(state, 1);

    expect(state.enemies[0].speedMultiplier).toBe(1);
    expect(state.enemies[0].progress).toBeCloseTo(11.15);
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

  it('does not advance combat for invalid or non-positive elapsed time', () => {
    const state = combatState('arrow');
    spawnEnemy(state, 'slime', 0);
    state.enemies[0].progress = 2;

    updateGame(state, Number.NaN);
    updateGame(state, Number.POSITIVE_INFINITY);
    updateGame(state, -1);
    updateGame(state, 0);

    expect(state.enemies[0].hp).toBe(42);
    expect(state.enemies[0].progress).toBe(2);
    expect(state.projectiles).toEqual([]);
  });
});
