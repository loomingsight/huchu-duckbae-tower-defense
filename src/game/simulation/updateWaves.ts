import { ENEMY_CATALOG, type EnemyType } from '../enemies/enemyCatalog';
import { getStageDefinition } from '../stages/stageCatalog';
import { isValidWaveGroup } from '../waves/stage1Waves';
import type { GameState } from './createGame';

export const INTER_WAVE_DELAY_SECONDS = 5;
export const MAX_WAVE_SPAWNS_PER_UPDATE = 1024;
const TIME_EPSILON = 1e-12;

export function spawnEnemy(state: GameState, type: EnemyType, waveIndex: number): void {
  const definition = ENEMY_CATALOG[type];
  const stage = getStageDefinition(state.stageKey);
  const scaledHp = definition.hp * stage.hpMultiplier * (1 + waveIndex * 0.08);
  state.enemies.push({
    id: state.nextEnemyId,
    type,
    hp: scaledHp,
    maxHp: scaledHp,
    progress: 0,
    speedMultiplier: 1,
    rewarded: false,
    lastHitAtSeconds: null,
  });
  if (type === 'minotaur' && state.bossSpawnedAtSeconds === null) {
    state.bossSpawnedAtSeconds = state.elapsedSeconds;
  }
  state.nextEnemyId += 1;
}

export function updateWaves(state: GameState, dt: number): void {
  if (state.wave.allSpawned || state.outcome !== 'playing') return;
  if (!Number.isFinite(dt) || dt < 0) return;

  let remaining = dt;
  const stage = getStageDefinition(state.stageKey);
  let canSpawnAtCurrentTime = remaining > 0;
  let steps = 0;
  while (steps < MAX_WAVE_SPAWNS_PER_UPDATE) {
    const currentWave = stage.waves[state.wave.index];
    if (currentWave === undefined) {
      state.wave.allSpawned = true;
      return;
    }

    if (state.wave.groupIndex >= currentWave.groups.length) {
      if (state.wave.index === stage.waves.length - 1) {
        state.wave.allSpawned = true;
        return;
      }
      if (state.enemies.length > 0) return;

      if (!state.wave.delayActive) {
        state.wave.delayActive = true;
        state.wave.delayRemaining = INTER_WAVE_DELAY_SECONDS;
      }
      if (remaining < state.wave.delayRemaining - TIME_EPSILON) {
        state.wave.delayRemaining -= remaining;
        return;
      }

      remaining = Math.max(0, remaining - state.wave.delayRemaining);
      state.wave.delayRemaining = 0;
      state.wave.delayActive = false;
      state.stats.completedWaves = Math.max(state.stats.completedWaves, state.wave.index + 1);
      state.wave.index += 1;
      state.wave.groupIndex = 0;
      state.wave.spawnedInGroup = 0;
      state.wave.spawnCooldown = 0;
      canSpawnAtCurrentTime = true;
      steps += 1;
      continue;
    }

    const group = currentWave.groups[state.wave.groupIndex];
    if (!isValidWaveGroup(group)) {
      state.wave.groupIndex += 1;
      state.wave.spawnedInGroup = 0;
      state.wave.spawnCooldown = 0;
      steps += 1;
      continue;
    }
    if (remaining === 0 && !canSpawnAtCurrentTime) return;
    if (state.wave.spawnCooldown > remaining) {
      state.wave.spawnCooldown -= remaining;
      return;
    }

    remaining -= state.wave.spawnCooldown;
    state.wave.spawnCooldown = 0;
    spawnEnemy(state, group.type, state.wave.index);
    state.wave.spawnedInGroup += 1;
    canSpawnAtCurrentTime = false;
    steps += 1;

    if (state.wave.spawnedInGroup === group.count) {
      state.wave.groupIndex += 1;
      state.wave.spawnedInGroup = 0;
      state.wave.spawnCooldown = 0;
    } else {
      state.wave.spawnCooldown = group.spawnInterval * stage.spawnIntervalMultiplier;
    }
  }
}
