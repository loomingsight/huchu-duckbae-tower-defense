import type { EnemyType } from '../enemies/enemyCatalog';
import type { Wave } from './stage1Waves';

const TYPES = ['slime', 'fairy', 'orc', 'golem', 'minotaur'] as const;
type WaveCounts = readonly [number, number, number, number, number];

const INTERVALS = [
  { slime: 0.70, fairy: 0.52, orc: 0.76, golem: 1.10 },
  { slime: 0.62, fairy: 0.48, orc: 0.70, golem: 1.02 },
  { slime: 0.55, fairy: 0.45, orc: 0.64, golem: 0.95 },
  { slime: 0.48, fairy: 0.42, orc: 0.57, golem: 0.88 },
  { slime: 0.42, fairy: 0.40, orc: 0.50, golem: 0.80 },
] as const;

function waves(rows: readonly WaveCounts[]): readonly Wave[] {
  return rows.map((counts, waveIndex) => ({
    groups: counts.flatMap((count, typeIndex) => {
      if (count === 0) return [];
      const type: EnemyType = TYPES[typeIndex];
      return [{
        type,
        count,
        spawnInterval: type === 'minotaur'
          ? 0
          : INTERVALS[Math.floor(waveIndex / 2)][type],
      }];
    }),
  }));
}

export const STAGE_2_WAVES = waves([
  [10, 0, 0, 0, 0],
  [8, 8, 0, 0, 0],
  [6, 10, 0, 0, 0],
  [0, 10, 4, 0, 0],
  [6, 8, 6, 0, 0],
  [0, 8, 8, 0, 0],
  [0, 6, 10, 3, 0],
  [0, 4, 12, 6, 0],
  [0, 2, 12, 7, 0],
  [0, 10, 10, 6, 1],
]);

export const STAGE_3_WAVES = waves([
  [8, 4, 0, 0, 0],
  [8, 0, 4, 0, 0],
  [8, 8, 6, 0, 0],
  [0, 9, 8, 0, 0],
  [0, 8, 10, 0, 0],
  [0, 6, 12, 0, 0],
  [0, 4, 10, 3, 0],
  [0, 2, 10, 5, 0],
  [0, 0, 8, 7, 0],
  [0, 8, 12, 7, 1],
]);

export const STAGE_4_WAVES = waves([
  [8, 0, 0, 0, 0],
  [6, 4, 0, 0, 0],
  [6, 7, 4, 0, 0],
  [0, 6, 8, 0, 0],
  [0, 4, 8, 2, 0],
  [0, 3, 10, 4, 0],
  [0, 2, 10, 6, 0],
  [0, 1, 10, 7, 0],
  [0, 0, 10, 7, 0],
  [0, 6, 12, 9, 1],
]);

export const STAGE_5_WAVES = waves([
  [12, 0, 0, 0, 0],
  [10, 8, 0, 0, 0],
  [10, 10, 4, 0, 0],
  [0, 10, 6, 0, 0],
  [0, 8, 8, 2, 0],
  [0, 6, 8, 3, 0],
  [0, 4, 8, 4, 0],
  [0, 2, 6, 6, 0],
  [0, 2, 8, 7, 0],
  [0, 10, 12, 8, 1],
]);

export const STAGE_6_WAVES = waves([
  [8, 4, 0, 0, 0],
  [8, 6, 2, 0, 0],
  [8, 8, 4, 0, 0],
  [0, 8, 8, 0, 0],
  [0, 6, 8, 2, 0],
  [0, 5, 8, 3, 0],
  [0, 4, 8, 5, 0],
  [0, 3, 8, 5, 0],
  [0, 2, 10, 7, 0],
  [0, 8, 14, 9, 1],
]);
