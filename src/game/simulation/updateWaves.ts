import {
  ENEMY_CATALOG,
  type EnemyType,
  type EnemyVariant,
} from '../enemies/enemyCatalog';
import { emitEnemyTraitEvent } from '../enemies/enemyTraits';
import { getStageDefinition } from '../stages/stageCatalog';
import { isValidWaveGroup } from '../waves/stage1Waves';
import type { GameState } from './createGame';

export const INTER_WAVE_DELAY_SECONDS = 5;
export const MAX_WAVE_SPAWNS_PER_UPDATE = 1024;
const TIME_EPSILON = 1e-12;

export function spawnEnemy(
  state: GameState,
  type: EnemyType,
  waveIndex: number,
  variant: EnemyVariant = 'standard',
): void {
  const definition = ENEMY_CATALOG[type];
  const stage = getStageDefinition(state.stageKey);
  const elite = variant === 'elite';
  const scaledHp = definition.hp
    * stage.hpMultiplier
    * (1 + waveIndex * 0.08)
    * (elite ? 1.8 : 1);
  const enemy = {
    id: state.nextEnemyId,
    type,
    variant,
    hp: scaledHp,
    maxHp: scaledHp,
    progress: 0,
    baseSpeed: definition.speed * (elite ? 1.05 : 1),
    slowMultiplier: 1,
    auraMultiplier: 1,
    auraRemaining: 0,
    reward: Math.round(
      definition.reward * stage.rewardMultiplier * (elite ? 1.5 : 1),
    ),
    leak: definition.leak,
    combatScore: definition.combatScore + (elite ? 100 : 0),
    boss: definition.boss,
    splitGeneration: 0 as const,
    shieldHitsRemaining: type === 'skeletonKnight' ? 3 : 0,
    lastSlowResistEffectAtSeconds: null,
    armorStage: 0 as const,
    auraCooldownRemaining: type === 'lichKing' ? 7 : 0,
    lichPhase: 1 as const,
    rewarded: false,
    lastHitAtSeconds: null,
  };
  state.enemies.push(enemy);
  if (type === 'shadowSlime') {
    emitEnemyTraitEvent(state, enemy, 'split-open');
  }
  if (type === 'skeletonKnight') {
    emitEnemyTraitEvent(state, enemy, 'shield-open');
  }
  if (definition.boss && state.bossSpawnedAtSeconds === null) {
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
    spawnEnemy(state, group.type, state.wave.index, group.variant);
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
