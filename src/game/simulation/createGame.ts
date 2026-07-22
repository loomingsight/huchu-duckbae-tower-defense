import type { EnemyType } from '../enemies/enemyCatalog';
import { normalizeStageId, type StageId } from '../stages/stageCatalog';
import type { TowerType } from '../towers/towerCatalog';
import type { Cell, Vec2 } from '../types';

export type Outcome = 'playing' | 'victory' | 'defeat';

export const INITIAL_GOLD = 320;

export type GameEnemy = {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  progress: number;
  speedMultiplier: number;
  rewarded: boolean;
  lastHitAtSeconds: number | null;
};

export type GameTower = {
  id: number;
  type: TowerType;
  cell: Cell;
  position: Vec2;
  cooldownRemaining: number;
  placedAtSeconds: number;
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
  stageId: StageId;
  elapsedSeconds: number;
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
  bossSpawnedAtSeconds: number | null;
  stats: {
    defeatedEnemies: number;
    leakedEnemies: number;
    completedWaves: number;
    bossDefeated: boolean;
  };
};

export function createGame(stageId: unknown = 1): GameState {
  return {
    stageId: normalizeStageId(stageId),
    elapsedSeconds: 0,
    gold: INITIAL_GOLD,
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
    bossSpawnedAtSeconds: null,
    stats: {
      defeatedEnemies: 0,
      leakedEnemies: 0,
      completedWaves: 0,
      bossDefeated: false,
    },
  };
}
