import type { EnemyType } from '../enemies/enemyCatalog';

export type WaveGroup = {
  type: EnemyType;
  count: number;
  spawnInterval: number;
};

export type Wave = {
  groups: readonly WaveGroup[];
};

export const STAGE_1_WAVES: readonly Wave[] = [
  { groups: [{ type: 'slime', count: 8, spawnInterval: 0.7 }] },
  { groups: [{ type: 'slime', count: 12, spawnInterval: 0.65 }] },
  { groups: [{ type: 'slime', count: 10, spawnInterval: 0.6 }, { type: 'fairy', count: 6, spawnInterval: 0.5 }] },
  { groups: [{ type: 'fairy', count: 8, spawnInterval: 0.5 }, { type: 'orc', count: 6, spawnInterval: 0.75 }] },
  { groups: [{ type: 'slime', count: 10, spawnInterval: 0.55 }, { type: 'orc', count: 8, spawnInterval: 0.7 }] },
  { groups: [{ type: 'fairy', count: 12, spawnInterval: 0.45 }, { type: 'orc', count: 8, spawnInterval: 0.65 }] },
  { groups: [{ type: 'orc', count: 10, spawnInterval: 0.6 }, { type: 'golem', count: 4, spawnInterval: 1.1 }] },
  { groups: [{ type: 'fairy', count: 10, spawnInterval: 0.42 }, { type: 'orc', count: 10, spawnInterval: 0.55 }, { type: 'golem', count: 6, spawnInterval: 0.95 }] },
  { groups: [{ type: 'orc', count: 12, spawnInterval: 0.5 }, { type: 'golem', count: 8, spawnInterval: 0.85 }] },
  { groups: [{ type: 'fairy', count: 10, spawnInterval: 0.4 }, { type: 'orc', count: 10, spawnInterval: 0.5 }, { type: 'golem', count: 6, spawnInterval: 0.8 }, { type: 'minotaur', count: 1, spawnInterval: 0 }] },
];
