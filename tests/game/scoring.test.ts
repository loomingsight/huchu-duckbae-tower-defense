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
      combatScore: 1750,
      hpScore: 2000,
      bossScore: 1500,
      timeBonus: 2500,
      difficultyBonus: 0,
    });
    expect(score.total).toBe(12750);
    expect(score.stars).toBe(3);
    expect(score.nextStarScore).toBeNull();
  });

  it('applies the nightmare combat score and 1.5 difficulty bonus', () => {
    const game = createGame('nightmare-1');
    game.stats.completedWaves = 10;
    game.stats.combatScore = 7095;
    game.stats.bossDefeated = true;
    game.baseHp = 8;

    const score = calculateGameScore(game, 'victory', 360);

    expect(score.breakdown).toEqual({
      waveScore: 5000,
      combatScore: 7095,
      hpScore: 800,
      bossScore: 1500,
      timeBonus: 1200,
      difficultyBonus: 7797,
    });
    expect(score.total).toBe(23392);
    expect(score.stars).toBe(3);
    expect(score.nextStarScore).toBeNull();
  });

  it('awards no stars or time bonus on defeat and exposes the two-star goal', () => {
    const game = createGame('nightmare-1');
    game.stats.completedWaves = 2;
    game.stats.combatScore = 200;
    game.baseHp = 0;

    const score = calculateGameScore(game, 'defeat', 92);

    expect(score.total).toBe(1800);
    expect(score.breakdown.timeBonus).toBe(0);
    expect(score.breakdown.difficultyBonus).toBe(600);
    expect(score.stars).toBe(0);
    expect(score.nextStarScore).toBe(18500);
  });
});
