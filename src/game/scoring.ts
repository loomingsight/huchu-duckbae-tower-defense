import type { GameState, Outcome } from './simulation/createGame';
import { getStageDefinition } from './stages/stageCatalog';

export type StarRating = 0 | 1 | 2 | 3;

export type ScoreBreakdown = Readonly<{
  waveScore: number;
  combatScore: number;
  hpScore: number;
  bossScore: number;
  timeBonus: number;
  difficultyBonus: number;
}>;

export type GameScore = Readonly<{
  total: number;
  stars: StarRating;
  nextStarScore: number | null;
  breakdown: ScoreBreakdown;
}>;

export function calculateGameScore(
  game: Readonly<GameState>,
  outcome: Outcome,
  elapsedSeconds: number,
): GameScore {
  const stage = getStageDefinition(game.stageKey);
  const completedWaves = Math.max(0, Math.floor(game.stats.completedWaves));
  const defeatedEnemies = Math.max(0, Math.floor(game.stats.defeatedEnemies));
  const baseHp = Math.max(0, Math.floor(game.baseHp));
  const clearSeconds = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  const combatScore = stage.mode === 'nightmare'
    ? Math.max(0, Math.floor(game.stats.combatScore))
    : defeatedEnemies * 25;
  const baseBreakdown = {
    waveScore: completedWaves * 500,
    combatScore,
    hpScore: baseHp * 100,
    bossScore: game.stats.bossDefeated ? 1500 : 0,
    timeBonus: outcome === 'victory' ? Math.max(0, 3000 - Math.floor(clearSeconds * 5)) : 0,
  };
  const subtotal = Object.values(baseBreakdown).reduce((sum, value) => sum + value, 0);
  const total = Math.floor(subtotal * stage.scoreMultiplier);
  const stars: StarRating = outcome !== 'victory'
    ? 0
    : total >= stage.threeStarScore
      ? 3
      : total >= stage.twoStarScore ? 2 : 1;
  const breakdown: ScoreBreakdown = {
    ...baseBreakdown,
    difficultyBonus: total - subtotal,
  };
  return {
    total,
    stars,
    nextStarScore: stars <= 1
      ? stage.twoStarScore
      : stars === 2 ? stage.threeStarScore : null,
    breakdown,
  };
}
