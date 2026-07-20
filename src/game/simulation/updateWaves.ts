import { ENEMY_CATALOG, type EnemyType } from '../enemies/enemyCatalog';
import { STAGE_1_WAVES } from '../waves/stage1Waves';
import type { GameState } from './createGame';

export const INTER_WAVE_DELAY_SECONDS = 5;

export function spawnEnemy(state: GameState, type: EnemyType, waveIndex: number): void {
  const definition = ENEMY_CATALOG[type];
  const scaledHp = definition.hp * (1 + waveIndex * 0.08);
  state.enemies.push({
    id: state.nextEnemyId,
    type,
    hp: scaledHp,
    maxHp: scaledHp,
    progress: 0,
    speedMultiplier: 1,
    rewarded: false,
  });
  state.nextEnemyId += 1;
}

export function updateWaves(state: GameState, dt: number): void {
  if (state.wave.allSpawned || state.outcome !== 'playing') return;

  const safeDt = Number.isFinite(dt) && dt >= 0 ? dt : 0;
  const currentWave = STAGE_1_WAVES[state.wave.index];
  if (state.wave.groupIndex >= currentWave.groups.length) {
    advanceCompletedWave(state, safeDt);
    return;
  }

  let remaining = safeDt;
  while (state.wave.groupIndex < currentWave.groups.length) {
    if (state.wave.spawnCooldown > remaining) {
      state.wave.spawnCooldown -= remaining;
      return;
    }

    remaining -= state.wave.spawnCooldown;
    state.wave.spawnCooldown = 0;
    const group = currentWave.groups[state.wave.groupIndex];
    spawnEnemy(state, group.type, state.wave.index);
    state.wave.spawnedInGroup += 1;
    state.wave.spawnCooldown = group.spawnInterval;

    if (state.wave.spawnedInGroup === group.count) {
      state.wave.groupIndex += 1;
      state.wave.spawnedInGroup = 0;
      if (state.wave.index === STAGE_1_WAVES.length - 1
        && state.wave.groupIndex === currentWave.groups.length) {
        state.wave.allSpawned = true;
      }
    }

    if (state.wave.allSpawned || remaining === 0 || state.wave.spawnCooldown > 0) return;
  }

  advanceCompletedWave(state, remaining);
}

function advanceCompletedWave(state: GameState, dt: number): void {
  if (state.enemies.length > 0) return;

  if (state.wave.index === STAGE_1_WAVES.length - 1) {
    state.wave.allSpawned = true;
    return;
  }

  if (state.wave.delayRemaining === 0) {
    state.wave.delayRemaining = INTER_WAVE_DELAY_SECONDS;
  }
  state.wave.delayRemaining = Math.max(0, state.wave.delayRemaining - dt);
  if (state.wave.delayRemaining > 0) return;

  state.wave.index += 1;
  state.wave.groupIndex = 0;
  state.wave.spawnedInGroup = 0;
  state.wave.spawnCooldown = 0;
}
