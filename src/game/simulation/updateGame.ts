import type { GameState } from './createGame';
import { updateProjectiles } from '../combat/updateProjectiles';
import { updateSlow } from '../combat/updateSlow';
import { updateTowers } from '../combat/updateTowers';
import { updateEnemies } from './updateEnemies';
import { updateWaves } from './updateWaves';
import { getStageDefinition } from '../stages/stageCatalog';
import { updateEnemyTraits } from '../enemies/enemyTraits';

export function updateGame(state: GameState, dt: number): void {
  state.hitEvents = [];
  state.traitEvents = [];
  if (state.outcome !== 'playing') return;

  const safeDt = Number.isFinite(dt) && dt >= 0 ? dt : 0;
  const stage = getStageDefinition(state.stageKey);
  state.elapsedSeconds += safeDt;
  const hadEnemies = state.enemies.length > 0;
  updateSlow(state);
  updateTowers(state, safeDt);
  updateProjectiles(state, safeDt);
  updateEnemyTraits(state, safeDt);
  updateEnemies(state, safeDt);
  const activeEnemyIds = new Set(state.enemies.map((enemy) => enemy.id));
  state.projectiles = state.projectiles.filter((projectile) => (
    activeEnemyIds.has(projectile.targetId)
  ));
  if (state.baseHp === 0) return;

  const currentWave = stage.waves[state.wave.index];
  const clearedCompletedWave = hadEnemies
    && state.enemies.length === 0
    && currentWave !== undefined
    && state.wave.groupIndex >= currentWave.groups.length;
  updateWaves(state, clearedCompletedWave ? 0 : safeDt);

  if (state.outcome === 'playing' && state.wave.allSpawned && state.enemies.length === 0) {
    state.stats.completedWaves = stage.waves.length;
    state.outcome = 'victory';
  }
}
