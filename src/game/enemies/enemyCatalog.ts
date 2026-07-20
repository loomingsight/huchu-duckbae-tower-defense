export const ENEMY_TYPES = ['slime', 'fairy', 'orc', 'golem', 'minotaur'] as const;

export type EnemyType = (typeof ENEMY_TYPES)[number];

export type EnemyDefinition = {
  hp: number;
  speed: number;
  reward: number;
  leak: number;
};

export const ENEMY_CATALOG: Readonly<Record<EnemyType, EnemyDefinition>> = {
  slime: { hp: 42, speed: 1.15, reward: 10, leak: 1 },
  fairy: { hp: 32, speed: 1.9, reward: 14, leak: 1 },
  orc: { hp: 110, speed: 0.9, reward: 20, leak: 2 },
  golem: { hp: 320, speed: 0.52, reward: 38, leak: 3 },
  minotaur: { hp: 1800, speed: 0.48, reward: 200, leak: 8 },
};
