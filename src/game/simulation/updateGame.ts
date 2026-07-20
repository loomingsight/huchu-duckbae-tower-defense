import type { GameState } from './createGame';
import { updateProjectiles } from '../combat/updateProjectiles';
import { updateSlow } from '../combat/updateSlow';
import { updateTowers } from '../combat/updateTowers';
import { updateEnemies } from './updateEnemies';
import { updateWaves } from './updateWaves';
import { STAGE_1_WAVES } from '../waves/stage1Waves';

export function updateGame(state: GameState, dt: number): void {
  state.hitEvents = [];
  if (state.outcome !== 'playing') return;

  const safeDt = Number.isFinite(dt) && dt >= 0 ? dt : 0;
  const hadEnemies = state.enemies.length > 0;
  updateSlow(state);
  updateTowers(state, safeDt);
  updateProjectiles(state, safeDt);
  updateEnemies(state, safeDt);
  const activeEnemyIds = new Set(state.enemies.map((enemy) => enemy.id));
  state.projectiles = state.projectiles.filter((projectile) => (
    activeEnemyIds.has(projectile.targetId)
  ));
  if (state.baseHp === 0) return;

  const currentWave = STAGE_1_WAVES[state.wave.index];
  const clearedCompletedWave = hadEnemies
    && state.enemies.length === 0
    && currentWave !== undefined
    && state.wave.groupIndex >= currentWave.groups.length;
  updateWaves(state, clearedCompletedWave ? 0 : safeDt);

  if (state.outcome === 'playing' && state.wave.allSpawned && state.enemies.length === 0) {
    state.outcome = 'victory';
  }
}
