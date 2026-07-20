import { TOWER_CATALOG } from '../towers/towerCatalog';
import type {
  GameHitEvent,
  GameProjectile,
  GameTower,
} from '../simulation/createGame';
import type { Vec2 } from '../types';
import type { CanvasLayout } from './layout';
import { worldToScreen } from './drawMap';

export type FloatingGold = {
  readonly position: Readonly<Vec2>;
  readonly value: number;
  readonly ageSeconds: number;
};

export type EffectSnapshot = {
  readonly towers: readonly Readonly<GameTower>[];
  readonly projectiles: readonly Readonly<GameProjectile>[];
  readonly hitEvents: readonly Readonly<GameHitEvent>[];
};

function drawSlowAuras(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  towers: readonly Readonly<GameTower>[],
  timeSeconds: number,
): void {
  const pulse = 0.94 + Math.sin(timeSeconds * 3.5) * 0.04;
  for (const tower of towers) {
    if (tower.type !== 'slow') continue;
    const center = worldToScreen(layout, tower.position);
    const radius = TOWER_CATALOG.slow.range * layout.cellSize * pulse;
    ctx.fillStyle = 'rgba(116, 102, 215, 0.075)';
    ctx.strokeStyle = 'rgba(139, 217, 226, 0.4)';
    ctx.lineWidth = Math.max(1, 1.5 / layout.dpr);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawArrowProjectile(
  ctx: CanvasRenderingContext2D,
  center: Readonly<Vec2>,
  size: number,
): void {
  ctx.strokeStyle = '#f7d477';
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.beginPath();
  ctx.moveTo(center.x - size * 0.45, center.y + size * 0.3);
  ctx.lineTo(center.x + size * 0.45, center.y - size * 0.3);
  ctx.stroke();
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  center: Readonly<Vec2>,
  radius: number,
  outer: string,
  inner: string,
): void {
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(center.x - radius * 0.22, center.y - radius * 0.22, radius * 0.48, 0, Math.PI * 2);
  ctx.fill();
}

function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  projectiles: readonly Readonly<GameProjectile>[],
): void {
  for (const projectile of projectiles) {
    const center = worldToScreen(layout, projectile.position);
    const size = Math.max(5, layout.cellSize * 0.2);
    if (projectile.towerType === 'arrow') {
      drawArrowProjectile(ctx, center, size);
    } else if (projectile.towerType === 'deokbae') {
      drawOrb(ctx, center, size * 0.62, '#de4d2f', '#ffb03c');
    } else if (projectile.towerType === 'huchu') {
      drawOrb(ctx, center, size * 0.78, '#1ca5c4', '#a8f4ff');
    }
  }
}

function drawHitEvent(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  event: Readonly<GameHitEvent>,
): void {
  const center = worldToScreen(layout, event.position);
  const effectRadius = Math.max(layout.cellSize * 0.24, event.radius * layout.cellSize);

  if (event.towerType === 'arrow') {
    ctx.strokeStyle = '#ffe399';
    ctx.lineWidth = Math.max(1.5, 2 / layout.dpr);
    for (let index = 0; index < 4; index += 1) {
      const angle = (Math.PI / 2) * index + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(
        center.x + Math.cos(angle) * effectRadius * 0.25,
        center.y + Math.sin(angle) * effectRadius * 0.25,
      );
      ctx.lineTo(
        center.x + Math.cos(angle) * effectRadius,
        center.y + Math.sin(angle) * effectRadius,
      );
      ctx.stroke();
    }
    return;
  }

  ctx.lineWidth = Math.max(2, 3 / layout.dpr);
  ctx.strokeStyle = event.towerType === 'huchu'
    ? 'rgba(61, 213, 239, 0.86)'
    : 'rgba(246, 101, 46, 0.88)';
  ctx.fillStyle = event.towerType === 'huchu'
    ? 'rgba(73, 211, 235, 0.2)'
    : 'rgba(255, 142, 50, 0.2)';
  ctx.beginPath();
  ctx.arc(center.x, center.y, effectRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawFloatingGold(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  gold: readonly FloatingGold[],
): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.max(11, layout.cellSize * 0.32)}px system-ui, sans-serif`;
  for (const pop of gold) {
    const center = worldToScreen(layout, pop.position);
    const age = Math.max(0, pop.ageSeconds);
    ctx.globalAlpha = Math.max(0, 1 - age / 0.9);
    ctx.fillStyle = '#ffe27a';
    ctx.fillText(`+${Math.max(0, Math.round(pop.value))}`, center.x, center.y - age * layout.cellSize);
  }
  ctx.globalAlpha = 1;
}

export function drawCombatEffects(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  snapshot: EffectSnapshot,
  options: Readonly<{ timeSeconds: number; floatingGold: readonly FloatingGold[] }>,
): void {
  drawSlowAuras(ctx, layout, snapshot.towers, options.timeSeconds);
  drawProjectiles(ctx, layout, snapshot.projectiles);
  for (const event of snapshot.hitEvents) drawHitEvent(ctx, layout, event);
  drawFloatingGold(ctx, layout, options.floatingGold);
}

export function drawPauseOverlay(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
): void {
  const { gameArea } = layout;
  ctx.fillStyle = 'rgba(21, 37, 31, 0.58)';
  ctx.fillRect(gameArea.x, gameArea.y, gameArea.width, gameArea.height);
  ctx.fillStyle = '#fff9e8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.max(18, layout.cellSize * 0.72)}px system-ui, sans-serif`;
  ctx.fillText('일시정지', gameArea.x + gameArea.width / 2, gameArea.y + gameArea.height / 2);
}

export function drawOrientationPrompt(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
): void {
  ctx.fillStyle = 'rgba(24, 42, 34, 0.86)';
  ctx.fillRect(0, 0, layout.viewport.width, layout.viewport.height);
  ctx.fillStyle = '#fff9e8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.max(18, layout.viewport.width * 0.055)}px system-ui, sans-serif`;
  ctx.fillText('가로 화면으로 돌려 주세요', layout.viewport.width / 2, layout.viewport.height / 2);
}
