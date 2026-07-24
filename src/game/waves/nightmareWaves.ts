import type { EnemyType } from '../enemies/enemyCatalog';
import type { StageNumber } from '../stages/stageIdentity';
import type { Wave, WaveGroup } from './stage1Waves';

const TYPES = [
  'shadowSlime',
  'vampireBat',
  'skeletonKnight',
  'obsidianGolem',
] as const;

const BASE_COUNTS = [
  [10, 0, 0, 0],
  [8, 6, 0, 0],
  [6, 8, 3, 0],
  [8, 4, 6, 0],
  [0, 8, 6, 0],
  [6, 6, 8, 2],
  [10, 8, 6, 3],
  [6, 8, 9, 4],
  [8, 6, 10, 5],
  [6, 8, 10, 5],
] as const;

const TYPE_WEIGHTS = [
  [1, 1, 1, 1],
  [0.90, 1.25, 1, 0.90],
  [0.85, 0.90, 1.30, 1],
  [1.30, 1.05, 1, 0.90],
  [0.80, 0.85, 1, 1.35],
  [1.05, 1.05, 1.10, 1.15],
] as const;

const ELITES: readonly EnemyType[] = [
  'skeletonKnight',
  'vampireBat',
  'skeletonKnight',
  'shadowSlime',
  'obsidianGolem',
  'obsidianGolem',
];

const INTERVALS = [
  [0.60, 0.46, 0.70, 1.05],
  [0.54, 0.42, 0.64, 0.98],
  [0.49, 0.39, 0.58, 0.90],
  [0.44, 0.36, 0.52, 0.84],
  [0.39, 0.33, 0.46, 0.76],
] as const;

export function createNightmareWaves(
  stageNumber: StageNumber,
  countMultiplier: number,
): readonly Wave[] {
  const stageIndex = stageNumber - 1;
  const safeCountMultiplier = Number.isFinite(countMultiplier) && countMultiplier > 0
    ? countMultiplier
    : 1;
  return BASE_COUNTS.map((counts, waveIndex) => {
    const groups: WaveGroup[] = counts.flatMap((baseCount, typeIndex) => {
      if (baseCount === 0) return [];
      return [{
        type: TYPES[typeIndex],
        count: Math.round(
          baseCount * safeCountMultiplier * TYPE_WEIGHTS[stageIndex][typeIndex],
        ),
        spawnInterval: INTERVALS[Math.floor(waveIndex / 2)][typeIndex],
      }];
    });

    if (waveIndex === 4) {
      groups.push({
        type: ELITES[stageIndex],
        count: 1,
        spawnInterval: 0,
        variant: 'elite',
      });
    }
    if (waveIndex === 9) {
      groups.push({ type: 'lichKing', count: 1, spawnInterval: 0 });
    }
    return { groups };
  });
}
