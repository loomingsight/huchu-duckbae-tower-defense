import { TOWER_CATALOG } from '../towers/towerCatalog';
import type { GameState } from '../simulation/createGame';
import { selectTarget } from './targeting';

const COOLDOWN_EPSILON = 1e-12;

export function updateTowers(state: GameState, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return;

  for (const tower of state.towers) {
    if (tower.type === 'slow') continue;
    const definition = TOWER_CATALOG[tower.type];
    const remainingAfterElapsed = tower.cooldownRemaining > COOLDOWN_EPSILON
      ? tower.cooldownRemaining - dt
      : tower.cooldownRemaining;
    tower.cooldownRemaining = remainingAfterElapsed;
    if (remainingAfterElapsed > COOLDOWN_EPSILON) continue;

    const target = selectTarget(tower, state.enemies, state.stageKey);
    if (target === undefined) {
      tower.cooldownRemaining = 0;
      continue;
    }

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
    const nextCooldown = (definition.cooldown ?? 0) + Math.min(0, remainingAfterElapsed);
    tower.cooldownRemaining = Math.abs(nextCooldown) <= COOLDOWN_EPSILON
      ? 0
      : Math.max(0, nextCooldown);
  }
}
