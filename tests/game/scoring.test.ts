import { describe, expect, it } from 'vitest';

import { calculateGameScore } from '../../src/game/scoring';
import { createGame } from '../../src/game/simulation/createGame';

describe('game scoring', () => {
  it('calculates the approved victory breakdown and three-star threshold', () => {
    const game = createGame();
    game.stats.completedWaves = 10;
    game.stats.defeatedEnemies = 70;
    game.stats.bossDefeated = true;
    game.baseHp = 20;

    const score = calculateGameScore(game, 'victory', 100);

    expect(score.breakdown).toEqual({
      waveScore: 5000,
      killScore: 1750,
      hpScore: 2000,
      bossScore: 1500,
      timeBonus: 2500,
    });
    expect(score.total).toBe(12750);
    expect(score.stars).toBe(3);
    expect(score.nextStarScore).toBeNull();
  });

  it('does not award a time bonus on defeat and exposes the next star goal', () => {
    const game = createGame();
    game.stats.completedWaves = 2;
    game.stats.defeatedEnemies = 8;
    game.baseHp = 0;

    const score = calculateGameScore(game, 'defeat', 92);

    expect(score.total).toBe(1200);
    expect(score.breakdown.timeBonus).toBe(0);
    expect(score.stars).toBe(1);
    expect(score.nextStarScore).toBe(7000);
  });
});
