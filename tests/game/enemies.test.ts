import { describe, expect, it } from 'vitest';
import { ENEMY_CATALOG } from '../../src/game/enemies/enemyCatalog';
import { createGame } from '../../src/game/simulation/createGame';
import { updateEnemies } from '../../src/game/simulation/updateEnemies';
import { spawnEnemy } from '../../src/game/simulation/updateWaves';
import { STAGE_1_WAVES } from '../../src/game/waves/stage1Waves';

describe('enemy catalog and movement', () => {
  it('defines the faster fairy and the sturdier golem', () => {
    expect(ENEMY_CATALOG.fairy.speed).toBeGreaterThan(ENEMY_CATALOG.slime.speed);
    expect(ENEMY_CATALOG.golem.hp).toBeGreaterThan(ENEMY_CATALOG.orc.hp);
  });

  it('uses the approved rewards and total stage-one economy', () => {
    expect(Object.fromEntries(Object.entries(ENEMY_CATALOG).map(([type, enemy]) => [
      type,
      enemy.reward,
    ]))).toEqual({
      slime: 8,
      fairy: 10,
      orc: 15,
      golem: 28,
      minotaur: 150,
    });

    const totalReward = STAGE_1_WAVES
      .flatMap((wave) => wave.groups)
      .reduce((total, group) => total + ENEMY_CATALOG[group.type].reward * group.count, 0);
    expect(totalReward).toBe(2_562);
  });

  it('moves a fairy farther than a slime in one second', () => {
    const slimeGame = createGame();
    const fairyGame = createGame();
    spawnEnemy(slimeGame, 'slime', 0);
    spawnEnemy(fairyGame, 'fairy', 0);

    updateEnemies(slimeGame, 1);
    updateEnemies(fairyGame, 1);

    expect(fairyGame.enemies[0].progress).toBeGreaterThan(slimeGame.enemies[0].progress);
  });

  it('scales spawned enemy HP by its zero-based wave index', () => {
    const state = createGame();
    spawnEnemy(state, 'golem', 5);

    expect(state.enemies[0].maxHp).toBe(320 * 1.4);
    expect(state.enemies[0].hp).toBe(320 * 1.4);
  });

  it('grants an enemy reward only once after it is killed', () => {
    const state = createGame();
    spawnEnemy(state, 'slime', 0);
    state.enemies[0].hp = 0;

    updateEnemies(state, 0);
    updateEnemies(state, 0);

    expect(state.gold).toBe(328);
    expect(state.enemies).toEqual([]);
  });
});
