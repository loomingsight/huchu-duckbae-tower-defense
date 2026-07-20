import { TOWER_CATALOG } from '../towers/towerCatalog';
import type { GameState } from '../simulation/createGame';
import { isWithinRadius } from './radius';
import { enemyPosition } from './targeting';

export function updateSlow(state: GameState): void {
  for (const enemy of state.enemies) {
    enemy.speedMultiplier = 1;
  }

  for (const tower of state.towers) {
    if (tower.type !== 'slow') continue;
    const definition = TOWER_CATALOG.slow;

    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;
      const position = enemyPosition(enemy);
      if (position === undefined) continue;
      if (isWithinRadius(tower.position, position, definition.range)) {
        enemy.speedMultiplier = Math.min(enemy.speedMultiplier, definition.multiplier ?? 1);
      }
    }
  }
}
