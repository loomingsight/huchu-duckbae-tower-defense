import { TOWER_CATALOG } from '../towers/towerCatalog';
import type {
  GameHitEvent,
  GameProjectile,
  GameTower,
} from '../simulation/createGame';
import type { Vec2 } from '../types';
import {
  createGoldPop,
  createSlowPulse,
  effectForHit,
  updateEffects,
  type RuntimeEffect,
} from './effects';
import type { CanvasLayout } from './layout';
import { isRenderablePoint, worldToScreen } from './drawMap';

export type FloatingGold = {
  readonly position: Readonly<Vec2>;
  readonly value: number;
  readonly ageSeconds: number;
};

export type EffectSnapshot = {
  readonly gold: number;
  readonly towers: readonly Readonly<GameTower>[];
  readonly projectiles: readonly Readonly<GameProjectile>[];
  readonly hitEvents: readonly Readonly<GameHitEvent>[];
};

type RetainedEffects = {
  effects: RuntimeEffect[];
  lastTimeSeconds: number | null;
  lastHitEvents: readonly Readonly<GameHitEvent>[] | null;
  lastGold: number;
  slowTowerIds: Set<number>;
};

const retainedBySnapshot = new WeakMap<object, RetainedEffects>();

function retainedEffects(snapshot: EffectSnapshot): RetainedEffects {
  const key = snapshot as object;
  const existing = retainedBySnapshot.get(key);
  if (existing !== undefined) return existing;
  const created: RetainedEffects = {
    effects: [],
    lastTimeSeconds: null,
    lastHitEvents: null,
    lastGold: snapshot.gold,
    slowTowerIds: new Set(),
  };
  retainedBySnapshot.set(key, created);
  return created;
}

function advanceEffects(snapshot: EffectSnapshot, timeSeconds: number): RetainedEffects {
  const retained = retainedEffects(snapshot);
  const safeTime = Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0;
  const restarted = retained.lastTimeSeconds !== null && safeTime < retained.lastTimeSeconds;
  if (restarted) {
    retained.effects = [];
    retained.lastHitEvents = null;
    retained.lastGold = snapshot.gold;
    retained.slowTowerIds.clear();
  }
  const delta = retained.lastTimeSeconds === null || restarted
    ? 0
    : safeTime - retained.lastTimeSeconds;
  retained.effects = updateEffects(retained.effects, delta);
  retained.lastTimeSeconds = safeTime;

  if (retained.lastHitEvents !== snapshot.hitEvents) {
    retained.lastHitEvents = snapshot.hitEvents;
    for (const event of snapshot.hitEvents) {
      const effect = effectForHit(event);
      if (effect !== null) retained.effects.push(effect);
    }
  }

  const earnedGold = snapshot.gold - retained.lastGold;
  if (earnedGold > 0) {
    const position = snapshot.hitEvents.at(-1)?.position;
    if (position !== undefined) {
      const gold = createGoldPop(position, earnedGold);
      if (gold !== null) retained.effects.push(gold);
    }
  }
  retained.lastGold = snapshot.gold;

  for (const tower of snapshot.towers) {
    if (tower.type !== 'slow' || retained.slowTowerIds.has(tower.id)) continue;
    retained.slowTowerIds.add(tower.id);
    const pulse = createSlowPulse(tower.position);
    if (pulse !== null) retained.effects.push(pulse);
  }
  return retained;
}

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
): void {
  const retained = advanceEffects(snapshot, timeSeconds);
  drawSlowAuras(ctx, layout, snapshot.towers, timeSeconds);
  drawSlowPulses(ctx, layout, retained.effects);
}

export function drawForegroundEffects(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  snapshot: EffectSnapshot,
  floatingGold: readonly FloatingGold[],
): void {
  drawProjectiles(ctx, layout, snapshot.projectiles);
  for (const effect of retainedEffects(snapshot).effects) drawRuntimeEffect(ctx, layout, effect);
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
