export const ENEMY_TYPES = ['slime', 'fairy', 'orc', 'golem', 'minotaur'] as const;

export type EnemyType = (typeof ENEMY_TYPES)[number];

export type EnemyDefinition = {
  hp: number;
  speed: number;
  reward: number;
  leak: number;
};

export const ENEMY_CATALOG: Readonly<Record<EnemyType, EnemyDefinition>> = {
  slime: { hp: 50.4, speed: 1.15, reward: 8, leak: 1 },
  fairy: { hp: 38.4, speed: 2.28, reward: 10, leak: 1 },
  orc: { hp: 132, speed: 1.035, reward: 15, leak: 2 },
  golem: { hp: 384, speed: 0.52, reward: 28, leak: 3 },
  minotaur: { hp: 2160, speed: 0.48, reward: 150, leak: 8 },
};
