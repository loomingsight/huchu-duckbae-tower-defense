import { ENEMY_CATALOG } from '../enemies/enemyCatalog';
import { getStageDefinition } from '../stages/stageCatalog';
import type { GameState } from './createGame';

export function updateEnemies(state: GameState, dt: number): void {
  const safeDt = Number.isFinite(dt) && dt >= 0 ? dt : 0;
  const stage = getStageDefinition(state.stageKey);
  const routeLength = stage.map.pathCells.length - 1;
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

    enemy.progress += definition.speed * stage.speedMultiplier * enemy.speedMultiplier * safeDt;
    if (enemy.progress >= routeLength) {
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
