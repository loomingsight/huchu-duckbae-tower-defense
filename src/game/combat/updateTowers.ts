import { TOWER_CATALOG } from '../towers/towerCatalog';
import type { GameState } from '../simulation/createGame';
import { selectTarget } from './targeting';

export function updateTowers(state: GameState, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return;

  for (const tower of state.towers) {
    if (tower.type === 'slow') continue;
    const definition = TOWER_CATALOG[tower.type];
    tower.cooldownRemaining = Math.max(0, tower.cooldownRemaining - dt);
    if (tower.cooldownRemaining > 0) continue;

    const target = selectTarget(tower, state.enemies);
    if (target === undefined) continue;

    state.projectiles.push({
      id: state.nextProjectileId,
      towerType: tower.type,
      position: { ...tower.position },
      targetId: target.id,
      damage: definition.damage ?? 0,
      speed: definition.projectileSpeed ?? 0,
      splash: definition.splash ?? 0,
    });
    state.nextProjectileId += 1;
    tower.cooldownRemaining = definition.cooldown ?? 0;
  }
}
