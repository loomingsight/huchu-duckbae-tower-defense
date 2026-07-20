import { describe, expect, it } from 'vitest';
import { ENEMY_CATALOG } from '../../src/game/enemies/enemyCatalog';
import { createGame } from '../../src/game/simulation/createGame';
import { updateEnemies } from '../../src/game/simulation/updateEnemies';
import { spawnEnemy } from '../../src/game/simulation/updateWaves';

describe('enemy catalog and movement', () => {
  it('defines the faster fairy and the sturdier golem', () => {
    expect(ENEMY_CATALOG.fairy.speed).toBeGreaterThan(ENEMY_CATALOG.slime.speed);
    expect(ENEMY_CATALOG.golem.hp).toBeGreaterThan(ENEMY_CATALOG.orc.hp);
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

    expect(state.gold).toBe(460);
    expect(state.enemies).toEqual([]);
  });
});
