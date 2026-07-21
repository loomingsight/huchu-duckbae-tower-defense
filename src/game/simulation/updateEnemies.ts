import { ENEMY_CATALOG } from '../enemies/enemyCatalog';
import { STAGE_1 } from '../map/stage1';
import type { GameState } from './createGame';

const ROUTE_LENGTH = STAGE_1.pathCells.length - 1;

export function updateEnemies(state: GameState, dt: number): void {
  const safeDt = Number.isFinite(dt) && dt >= 0 ? dt : 0;
  const survivors = [];

  for (const enemy of state.enemies) {
    const definition = ENEMY_CATALOG[enemy.type];
    if (enemy.hp <= 0) {
      if (!enemy.rewarded) {
        state.gold += definition.reward;
        enemy.rewarded = true;
        state.stats.defeatedEnemies += 1;
        if (enemy.type === 'minotaur') state.stats.bossDefeated = true;
      }
      continue;
    }

    enemy.progress += definition.speed * enemy.speedMultiplier * safeDt;
    if (enemy.progress >= ROUTE_LENGTH) {
      state.baseHp = Math.max(0, state.baseHp - definition.leak);
      state.stats.leakedEnemies += 1;
      continue;
    }

    survivors.push(enemy);
  }

  state.enemies = survivors;
  if (state.baseHp === 0) {
    state.outcome = 'defeat';
  }
}
