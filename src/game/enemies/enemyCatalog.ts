export const NORMAL_ENEMY_TYPES = ['slime', 'fairy', 'orc', 'golem', 'minotaur'] as const;

export const NIGHTMARE_ENEMY_TYPES = [
  'shadowSlime',
  'vampireBat',
  'skeletonKnight',
  'obsidianGolem',
  'lichKing',
] as const;

export const ENEMY_TYPES = [...NORMAL_ENEMY_TYPES, ...NIGHTMARE_ENEMY_TYPES] as const;

export type EnemyType = (typeof ENEMY_TYPES)[number];
export type EnemyVariant = 'standard' | 'elite' | 'split-child';

export type EnemyDefinition = Readonly<{
  hp: number;
  speed: number;
  reward: number;
  leak: number;
  combatScore: number;
  boss: boolean;
  trait: 'none' | 'split' | 'slow-resistant' | 'shield' | 'armored' | 'speed-aura';
}>;

export const ENEMY_CATALOG: Readonly<Record<EnemyType, EnemyDefinition>> = {
  slime: {
    hp: 50.4, speed: 1.15, reward: 8, leak: 1,
    combatScore: 25, boss: false, trait: 'none',
  },
  fairy: {
    hp: 38.4, speed: 2.28, reward: 10, leak: 1,
    combatScore: 25, boss: false, trait: 'none',
  },
  orc: {
    hp: 132, speed: 1.035, reward: 15, leak: 2,
    combatScore: 25, boss: false, trait: 'none',
  },
  golem: {
    hp: 384, speed: 0.52, reward: 28, leak: 3,
    combatScore: 25, boss: false, trait: 'none',
  },
  minotaur: {
    hp: 2160, speed: 0.48, reward: 150, leak: 8,
    combatScore: 25, boss: true, trait: 'none',
  },
  shadowSlime: {
    hp: 72, speed: 1.1, reward: 4, leak: 1,
    combatScore: 15, boss: false, trait: 'split',
  },
  vampireBat: {
    hp: 64, speed: 2.55, reward: 10, leak: 1,
    combatScore: 25, boss: false, trait: 'slow-resistant',
  },
  skeletonKnight: {
    hp: 200, speed: 0.92, reward: 15, leak: 2,
    combatScore: 40, boss: false, trait: 'shield',
  },
  obsidianGolem: {
    hp: 620, speed: 0.44, reward: 28, leak: 3,
    combatScore: 75, boss: false, trait: 'armored',
  },
  lichKing: {
    hp: 3500, speed: 0.46, reward: 150, leak: 10,
    combatScore: 0, boss: true, trait: 'speed-aura',
  },
};
