import type { EnemyType } from '../enemies/enemyCatalog';
import type { TowerType } from '../towers/towerCatalog';
import type { Cell, Vec2 } from '../types';

export type Outcome = 'playing' | 'victory' | 'defeat';

export type GameEnemy = {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  progress: number;
  speedMultiplier: number;
  rewarded: boolean;
};

export type GameTower = {
  id: number;
  type: TowerType;
  cell: Cell;
  position: Vec2;
  cooldownRemaining: number;
};

export type GameProjectile = {
  id: number;
  towerType: TowerType;
  position: Vec2;
  targetId: number;
  damage: number;
  speed: number;
  splash: number;
};

export type GameHitEvent = {
  kind: 'hit';
  towerType: TowerType;
  position: Vec2;
  radius: number;
};

export type WaveState = {
  index: number;
  groupIndex: number;
  spawnedInGroup: number;
  spawnCooldown: number;
  delayRemaining: number;
  delayActive: boolean;
  allSpawned: boolean;
};

export type GameState = {
  gold: number;
  baseHp: number;
  outcome: Outcome;
  enemies: GameEnemy[];
  nextEnemyId: number;
  towers: GameTower[];
  nextTowerId: number;
  projectiles: GameProjectile[];
  nextProjectileId: number;
  hitEvents: GameHitEvent[];
  wave: WaveState;
};

export function createGame(_seed?: number): GameState {
  return {
    gold: 450,
    baseHp: 20,
    outcome: 'playing',
    enemies: [],
    nextEnemyId: 1,
    towers: [],
    nextTowerId: 1,
    projectiles: [],
    nextProjectileId: 1,
    hitEvents: [],
    wave: {
      index: 0,
      groupIndex: 0,
      spawnedInGroup: 0,
      spawnCooldown: 0,
      delayRemaining: 0,
      delayActive: false,
      allSpawned: false,
    },
  };
}
