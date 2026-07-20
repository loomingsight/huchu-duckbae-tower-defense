import { TOWER_CATALOG } from '../towers/towerCatalog';
import type { GameState } from '../simulation/createGame';
import { enemyPosition } from './targeting';

export function updateSlow(state: GameState): void {
  for (const enemy of state.enemies) {
    enemy.speedMultiplier = 1;
  }

  for (const tower of state.towers) {
    if (tower.type !== 'slow') continue;
    const definition = TOWER_CATALOG.slow;
    const rangeSquared = definition.range * definition.range;

    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;
      const position = enemyPosition(enemy);
      if (position === undefined) continue;
      const dx = position.x - tower.position.x;
      const dy = position.y - tower.position.y;
      if (dx * dx + dy * dy <= rangeSquared) {
        enemy.speedMultiplier = Math.min(enemy.speedMultiplier, definition.multiplier ?? 1);
      }
    }
  }
}
