export const TOWER_TYPES = ['slow', 'arrow', 'deokbae', 'huchu'] as const;

export type TowerType = (typeof TOWER_TYPES)[number];

export type TowerDefinition = {
  cost: number;
  range: number;
  multiplier?: number;
  damage?: number;
  cooldown?: number;
  projectileSpeed?: number;
  splash?: number;
};

export const TOWER_CATALOG: Readonly<Record<TowerType, TowerDefinition>> = {
  slow: { cost: 80, range: 2.4, multiplier: 0.62 },
  arrow: { cost: 100, range: 3.2, damage: 18, cooldown: 0.55, projectileSpeed: 8 },
  deokbae: {
    cost: 250,
    range: 3,
    damage: 14,
    cooldown: 0.42,
    projectileSpeed: 6.5,
    splash: 0.85,
  },
  huchu: {
    cost: 300,
    range: 3.4,
    damage: 72,
    cooldown: 1.8,
    projectileSpeed: 5,
    splash: 1.25,
  },
};
