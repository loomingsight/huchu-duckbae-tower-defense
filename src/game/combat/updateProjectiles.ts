import { applyEnemyDamage } from '../enemies/enemyTraits';
import type { GameState } from '../simulation/createGame';
import { isWithinRadius } from './radius';
import { enemyPosition } from './targeting';

export function updateProjectiles(state: GameState, dt: number): void {
  state.hitEvents = [];
  if (!Number.isFinite(dt) || dt <= 0) return;

  const activeProjectiles = [];

  for (const projectile of state.projectiles) {
    const target = state.enemies.find((enemy) => (
      enemy.id === projectile.targetId && enemy.hp > 0
    ));
    if (target === undefined) continue;

    const impactPosition = enemyPosition(target, state.stageKey);
    if (impactPosition === undefined) continue;
    const dx = impactPosition.x - projectile.position.x;
    const dy = impactPosition.y - projectile.position.y;
    const distance = Math.hypot(dx, dy);
    const travelDistance = projectile.speed * dt;

    if (distance <= travelDistance) {
      if (projectile.splash > 0) {
        for (const enemy of state.enemies) {
          if (enemy.hp <= 0) continue;
          const position = enemyPosition(enemy, state.stageKey);
          if (position === undefined) continue;
          if (isWithinRadius(impactPosition, position, projectile.splash)) {
            applyEnemyDamage(state, enemy, projectile.damage);
          }
        }
      } else {
        applyEnemyDamage(state, target, projectile.damage);
      }

      state.hitEvents.push({
        kind: 'hit',
        towerType: projectile.towerType,
        position: impactPosition,
        radius: projectile.splash,
      });
      continue;
    }

    if (distance > 0) {
      projectile.position.x += (dx / distance) * travelDistance;
      projectile.position.y += (dy / distance) * travelDistance;
    }
    activeProjectiles.push(projectile);
  }

  state.projectiles = activeProjectiles;
}
