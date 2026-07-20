import type { GameEnemy, GameState } from '../simulation/createGame';
import { enemyPosition } from './targeting';

function applyDamage(enemy: GameEnemy, damage: number): void {
  enemy.hp = Math.max(0, enemy.hp - damage);
}

export function updateProjectiles(state: GameState, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return;

  state.hitEvents = [];
  const activeProjectiles = [];

  for (const projectile of state.projectiles) {
    const target = state.enemies.find((enemy) => (
      enemy.id === projectile.targetId && enemy.hp > 0
    ));
    if (target === undefined) continue;

    const impactPosition = enemyPosition(target);
    if (impactPosition === undefined) continue;
    const dx = impactPosition.x - projectile.position.x;
    const dy = impactPosition.y - projectile.position.y;
    const distance = Math.hypot(dx, dy);
    const travelDistance = projectile.speed * dt;

    if (distance <= travelDistance) {
      if (projectile.splash > 0) {
        const splashSquared = projectile.splash * projectile.splash;
        for (const enemy of state.enemies) {
          if (enemy.hp <= 0) continue;
          const position = enemyPosition(enemy);
          if (position === undefined) continue;
          const impactDx = position.x - impactPosition.x;
          const impactDy = position.y - impactPosition.y;
          if (impactDx * impactDx + impactDy * impactDy <= splashSquared) {
            applyDamage(enemy, projectile.damage);
          }
        }
      } else {
        applyDamage(target, projectile.damage);
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
