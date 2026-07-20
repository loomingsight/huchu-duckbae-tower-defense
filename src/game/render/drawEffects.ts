import { TOWER_CATALOG } from '../towers/towerCatalog';
import type {
  GameProjectile,
  GameTower,
} from '../simulation/createGame';
import type { Vec2 } from '../types';
import type { RuntimeEffect } from './effects';
import type { CanvasLayout } from './layout';
import { isRenderablePoint, worldToScreen } from './drawMap';

export type FloatingGold = {
  readonly position: Readonly<Vec2>;
  readonly value: number;
  readonly ageSeconds: number;
};

export type EffectSnapshot = {
  readonly towers: readonly Readonly<GameTower>[];
  readonly projectiles: readonly Readonly<GameProjectile>[];
};

function drawSlowAuras(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  towers: readonly Readonly<GameTower>[],
  timeSeconds: number,
): void {
  const pulse = 0.94 + Math.sin(timeSeconds * 3.5) * 0.04;
  for (const tower of towers) {
    if (tower.type !== 'slow' || !isRenderablePoint(layout, tower.position)) continue;
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
    if (!isRenderablePoint(layout, projectile.position)) continue;
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

function effectProgress(effect: RuntimeEffect): number {
  return Math.min(1, Math.max(0, effect.age / effect.duration));
}

function drawRuntimeEffect(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  effect: RuntimeEffect,
): void {
  if (!isRenderablePoint(layout, effect.position)) return;
  const center = worldToScreen(layout, effect.position);
  const progress = effectProgress(effect);
  const alpha = 1 - progress;

  if (effect.kind === 'arrow-impact') {
    ctx.strokeStyle = `rgba(255, 227, 153, ${alpha})`;
    ctx.lineWidth = Math.max(1.5, 2 / layout.dpr);
    const radius = layout.cellSize * (0.16 + progress * 0.42);
    for (let index = 0; index < 4; index += 1) {
      const angle = (Math.PI / 2) * index + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(
        center.x + Math.cos(angle) * radius * 0.2,
        center.y + Math.sin(angle) * radius * 0.2,
      );
      ctx.lineTo(
        center.x + Math.cos(angle) * radius,
        center.y + Math.sin(angle) * radius,
      );
      ctx.stroke();
    }
    return;
  }

  if (effect.kind === 'fire-burst') {
    ctx.strokeStyle = `rgba(255, 115, 39, ${alpha})`;
    ctx.fillStyle = `rgba(255, 189, 59, ${alpha * 0.72})`;
    ctx.lineWidth = Math.max(2, layout.cellSize * 0.08);
    const radius = layout.cellSize * (0.2 + progress * 0.7);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius * 0.38, 0, Math.PI * 2);
    ctx.fill();
    for (let index = 0; index < 7; index += 1) {
      const angle = index * Math.PI * 2 / 7;
      ctx.beginPath();
      ctx.moveTo(center.x + Math.cos(angle) * radius * 0.35, center.y + Math.sin(angle) * radius * 0.35);
      ctx.lineTo(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius);
      ctx.stroke();
    }
    return;
  }

  if (effect.kind === 'aqua-splash') {
    ctx.strokeStyle = `rgba(61, 213, 239, ${alpha})`;
    ctx.fillStyle = 'rgba(73, 211, 235, 0.2)';
    ctx.lineWidth = Math.max(2, 2.5 / layout.dpr);
    const radius = layout.cellSize * (0.25 + progress * 1.05);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    for (let index = 0; index < 5; index += 1) {
      const angle = index * Math.PI * 2 / 5 - Math.PI / 2;
      const distance = radius * (0.55 + progress * 0.35);
      ctx.beginPath();
      ctx.arc(center.x + Math.cos(angle) * distance, center.y + Math.sin(angle) * distance, Math.max(1.5, layout.cellSize * 0.06), 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (effect.kind === 'gold-pop') {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffe27a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.max(11, layout.cellSize * 0.32)}px system-ui, sans-serif`;
    ctx.fillText(`+${Math.round(effect.value)}`, center.x, center.y - progress * layout.cellSize);
    ctx.globalAlpha = 1;
  }
}

function drawSlowPulses(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  effects: readonly RuntimeEffect[],
): void {
  for (const effect of effects) {
    if (effect.kind !== 'slow-pulse' || !isRenderablePoint(layout, effect.position)) continue;
    const center = worldToScreen(layout, effect.position);
    const progress = effectProgress(effect);
    ctx.strokeStyle = `rgba(126, 232, 255, ${1 - progress})`;
    ctx.lineWidth = Math.max(1.5, 2 / layout.dpr);
    ctx.beginPath();
    ctx.arc(center.x, center.y, layout.cellSize * (0.35 + progress * 2), 0, Math.PI * 2);
    ctx.stroke();
  }
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
    if (
      !isRenderablePoint(layout, pop.position)
      || !Number.isFinite(pop.value)
      || !Number.isFinite(pop.ageSeconds)
      || pop.ageSeconds >= 0.9
    ) {
      continue;
    }
    const center = worldToScreen(layout, pop.position);
    const age = Math.max(0, pop.ageSeconds);
    ctx.globalAlpha = Math.max(0, 1 - age / 0.9);
    ctx.fillStyle = '#ffe27a';
    ctx.fillText(`+${Math.max(0, Math.round(pop.value))}`, center.x, center.y - age * layout.cellSize);
  }
  ctx.globalAlpha = 1;
}

export function drawGroundEffects(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  snapshot: EffectSnapshot,
  timeSeconds: number,
  effects: readonly RuntimeEffect[],
): void {
  drawSlowAuras(ctx, layout, snapshot.towers, timeSeconds);
  drawSlowPulses(ctx, layout, effects);
}

export function drawForegroundEffects(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  snapshot: EffectSnapshot,
  floatingGold: readonly FloatingGold[],
  effects: readonly RuntimeEffect[],
): void {
  drawProjectiles(ctx, layout, snapshot.projectiles);
  for (const effect of effects) drawRuntimeEffect(ctx, layout, effect);
  drawFloatingGold(ctx, layout, floatingGold);
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
