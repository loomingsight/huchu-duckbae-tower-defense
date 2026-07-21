import type { GameState, Outcome } from './simulation/createGame';

export type ScoreBreakdown = Readonly<{
  waveScore: number;
  killScore: number;
  hpScore: number;
  bossScore: number;
  timeBonus: number;
}>;

export type GameScore = Readonly<{
  total: number;
  stars: 1 | 2 | 3;
  nextStarScore: number | null;
  breakdown: ScoreBreakdown;
}>;

export function calculateGameScore(
  game: Readonly<GameState>,
  outcome: Outcome,
  elapsedSeconds: number,
): GameScore {
  const completedWaves = Math.max(0, Math.floor(game.stats.completedWaves));
  const defeatedEnemies = Math.max(0, Math.floor(game.stats.defeatedEnemies));
  const baseHp = Math.max(0, Math.floor(game.baseHp));
  const clearSeconds = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  const breakdown = {
    waveScore: completedWaves * 500,
    killScore: defeatedEnemies * 25,
    hpScore: baseHp * 100,
    bossScore: game.stats.bossDefeated ? 1500 : 0,
    timeBonus: outcome === 'victory' ? Math.max(0, 3000 - Math.floor(clearSeconds * 5)) : 0,
  };
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const stars = total >= 10000 ? 3 : total >= 7000 ? 2 : 1;
  return {
    total,
    stars,
    nextStarScore: stars === 1 ? 7000 : stars === 2 ? 10000 : null,
    breakdown,
  };
}
