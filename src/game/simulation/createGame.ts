import type { EnemyType } from '../enemies/enemyCatalog';

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

export type WaveState = {
  index: number;
  groupIndex: number;
  spawnedInGroup: number;
  spawnCooldown: number;
  delayRemaining: number;
  allSpawned: boolean;
};

export type GameState = {
  gold: number;
  baseHp: number;
  outcome: Outcome;
  enemies: GameEnemy[];
  nextEnemyId: number;
  wave: WaveState;
};

export function createGame(_seed?: number): GameState {
  return {
    gold: 450,
    baseHp: 20,
    outcome: 'playing',
    enemies: [],
    nextEnemyId: 1,
    wave: {
      index: 0,
      groupIndex: 0,
      spawnedInGroup: 0,
      spawnCooldown: 0,
      delayRemaining: 0,
      allSpawned: false,
    },
  };
}
