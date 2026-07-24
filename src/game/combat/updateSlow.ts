import { TOWER_CATALOG } from '../towers/towerCatalog';
import {
  disruptEnemyShield,
  emitEnemyTraitEvent,
} from '../enemies/enemyTraits';
import type { GameState } from '../simulation/createGame';
import { isWithinRadius } from './radius';
import { enemyPosition } from './targeting';

export function updateSlow(state: GameState): void {
  for (const enemy of state.enemies) {
    enemy.slowMultiplier = 1;
  }

  for (const tower of state.towers) {
    if (tower.type !== 'slow') continue;
    const definition = TOWER_CATALOG.slow;

    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;
      const position = enemyPosition(enemy, state.stageKey);
      if (position === undefined) continue;
      if (isWithinRadius(tower.position, position, definition.range)) {
        disruptEnemyShield(state, enemy);
        const requested = definition.multiplier ?? 1;
        const resistance = enemy.type === 'vampireBat' ? 0.5 : 0;
        const effective = 1 - (1 - requested) * (1 - resistance);
        enemy.slowMultiplier = Math.min(enemy.slowMultiplier, effective);
        if (
          resistance > 0
          && (
            enemy.lastSlowResistEffectAtSeconds === null
            || state.elapsedSeconds - enemy.lastSlowResistEffectAtSeconds >= 0.8
          )
        ) {
          enemy.lastSlowResistEffectAtSeconds = state.elapsedSeconds;
          emitEnemyTraitEvent(state, enemy, 'slow-resist');
        }
      }
    }
  }
}
