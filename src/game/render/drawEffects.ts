import { enemyPosition } from '../combat/targeting';
import type {
  GameEnemy,
  GameProjectile,
  GameTower,
} from '../simulation/createGame';
import type { Vec2 } from '../types';
import type { GameAssets, LoadedSprite } from './assetLoader';
import type { RuntimeEffect } from './effects';
import type { CanvasLayout } from './layout';
import {
  isRenderableWorldPoint,
  projectWorldPoint,
  projectWorldRing,
  visualScaleAt,
  type ScreenPoint,
} from './projection';
import { SPRITE_FRAME_SIZES } from './spriteManifest';
import { drawSpriteFrame } from './spriteSheet';

export type FloatingGold = {
  readonly position: Readonly<Vec2>;
  readonly value: number;
  readonly ageSeconds: number;
};

export type EffectSnapshot = {
  readonly towers: readonly Readonly<GameTower>[];
  readonly projectiles: readonly Readonly<GameProjectile>[];
  readonly enemies: readonly Readonly<GameEnemy>[];
  readonly bossSpawnedAtSeconds?: number | null;
};

export function arrowFrameForScreenVector(vector: Readonly<Vec2>): number {
  const x = Number.isFinite(vector.x) ? vector.x : 0;
  const y = Number.isFinite(vector.y) ? vector.y : 0;
  if (x === 0 && y === 0) return 0;
  return (Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8;
}

function projectileFrame(
  projectile: Readonly<GameProjectile>,
  snapshot: EffectSnapshot,
  layout: CanvasLayout,
): number {
  const target = snapshot.enemies.find((enemy) => enemy.id === projectile.targetId);
  const targetPosition = target === undefined ? undefined : enemyPosition(target);
  if (targetPosition === undefined) return 0;
  const current = projectWorldPoint(layout, projectile.position);
  const destination = projectWorldPoint(layout, targetPosition);
  return arrowFrameForScreenVector({
    x: destination.x - current.x,
    y: destination.y - current.y,
  });
}

function drawCenteredFrame(
  ctx: CanvasRenderingContext2D,
  image: LoadedSprite,
  frame: number,
  size: number,
  center: Readonly<Vec2>,
): boolean {
  return drawSpriteFrame(ctx, image, frame, SPRITE_FRAME_SIZES.vfx, {
    x: center.x - size / 2,
    y: center.y - size / 2,
    width: size,
    height: size,
  });
}

function visualUnitAt(layout: CanvasLayout, position: Readonly<Vec2>): number {
  return layout.tileWidth * visualScaleAt(layout, position.y);
}

function tracePoints(
  ctx: CanvasRenderingContext2D,
  points: readonly ScreenPoint[],
): boolean {
  if (
    points.length === 0
    || points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))
  ) return false;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  return true;
}

function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  snapshot: EffectSnapshot,
  assets: GameAssets,
  timeSeconds: number,
): void {
  for (const projectile of snapshot.projectiles) {
    if (!isRenderableWorldPoint(layout, projectile.position)) continue;
    const center = projectWorldPoint(layout, projectile.position);
    const visualUnit = visualUnitAt(layout, projectile.position);
    const animationFrame = Math.floor(timeSeconds * 12 + projectile.id * 0.73) % 4;
    if (projectile.towerType === 'arrow') {
      if (!drawCenteredFrame(
        ctx,
        assets.vfx.arrow,
        projectileFrame(projectile, snapshot, layout),
        visualUnit * 1.55,
        center,
      )) {
        ctx.fillStyle = '#f8d377';
        ctx.fillRect(center.x - 2, center.y - 2, 5, 5);
      }
    } else if (projectile.towerType === 'deokbae') {
      if (!drawCenteredFrame(
        ctx,
        assets.vfx.fireball,
        animationFrame,
        visualUnit * 2.325,
        center,
      )) {
        ctx.fillStyle = '#ff7a2f';
        ctx.beginPath();
        ctx.arc(center.x, center.y, visualUnit * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (projectile.towerType === 'huchu') {
      if (!drawCenteredFrame(
        ctx,
        assets.vfx.waterball,
        animationFrame,
        visualUnit * 3.4,
        center,
      )) {
        ctx.fillStyle = '#5be3f1';
        ctx.beginPath();
        ctx.arc(center.x, center.y, visualUnit * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
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
  assets: GameAssets,
): void {
  if (!isRenderableWorldPoint(layout, effect.position)) return;
  const center = projectWorldPoint(layout, effect.position);
  const visualUnit = visualUnitAt(layout, effect.position);
  const progress = effectProgress(effect);
  let image: LoadedSprite = null;
  let frames = 1;
  let size = visualUnit * 2;
  if (effect.kind === 'arrow-impact') {
    image = assets.vfx.arrowImpact;
    frames = 4;
    size = visualUnit * 1.75;
  } else if (effect.kind === 'fire-burst') {
    image = assets.vfx.fireBurst;
    frames = 8;
    size = visualUnit * (2.25 + progress * 0.65);
  } else if (effect.kind === 'aqua-splash') {
    image = assets.vfx.aquaBurst;
    frames = 8;
    size = visualUnit * (2.45 + progress * 0.85);
  }

  if (image !== null) {
    const frame = Math.min(frames - 1, Math.floor(progress * frames));
    ctx.save();
    ctx.globalAlpha = Math.max(0.2, 1 - progress * 0.62);
    drawCenteredFrame(ctx, image, frame, size, center);
    ctx.restore();
    return;
  }

  if (effect.kind === 'gold-pop') {
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = '#ffe27a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.max(11, visualUnit * 0.28)}px system-ui, sans-serif`;
    ctx.fillText(`+${Math.round(effect.value)}`, center.x, center.y - progress * visualUnit);
    ctx.globalAlpha = 1;
  }
}

function drawSlowPulses(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  effects: readonly RuntimeEffect[],
): void {
  for (const effect of effects) {
    if (effect.kind !== 'slow-pulse' || !isRenderableWorldPoint(layout, effect.position)) continue;
    const progress = effectProgress(effect);
    if (!tracePoints(
      ctx,
      projectWorldRing(layout, effect.position, 0.35 + progress * 0.8),
    )) continue;
    ctx.strokeStyle = `rgba(170, 132, 255, ${1 - progress})`;
    ctx.lineWidth = Math.max(1.5, 2 / layout.dpr);
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
  for (const pop of gold) {
    if (
      !isRenderableWorldPoint(layout, pop.position)
      || !Number.isFinite(pop.value)
      || !Number.isFinite(pop.ageSeconds)
      || pop.ageSeconds >= 0.9
    ) continue;
    const center = projectWorldPoint(layout, pop.position);
    const visualUnit = visualUnitAt(layout, pop.position);
    const age = Math.max(0, pop.ageSeconds);
    ctx.globalAlpha = Math.max(0, 1 - age / 0.9);
    ctx.fillStyle = '#ffe27a';
    ctx.font = `900 ${Math.max(11, visualUnit * 0.28)}px system-ui, sans-serif`;
    ctx.fillText(`+${Math.max(0, Math.round(pop.value))}`, center.x, center.y - age * visualUnit);
  }
  ctx.globalAlpha = 1;
}

export function drawGroundEffects(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  effects: readonly RuntimeEffect[],
): void {
  drawSlowPulses(ctx, layout, effects);
}

export function drawForegroundEffects(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  snapshot: EffectSnapshot,
  floatingGold: readonly FloatingGold[],
  effects: readonly RuntimeEffect[],
  assets: GameAssets,
  timeSeconds: number,
): void {
  drawProjectiles(ctx, layout, snapshot, assets, timeSeconds);
  for (const effect of effects) drawRuntimeEffect(ctx, layout, effect, assets);
  drawFloatingGold(ctx, layout, floatingGold);
}

export function drawBossPresentation(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  bossSpawnedAtSeconds: number | null | undefined,
  timeSeconds: number,
): void {
  if (bossSpawnedAtSeconds === null || bossSpawnedAtSeconds === undefined) return;
  const age = timeSeconds - bossSpawnedAtSeconds;
  if (!Number.isFinite(age) || age < 0 || age > 1.4) return;
  const visibility = Math.sin(Math.min(1, age / 1.4) * Math.PI);
  const gradient = ctx.createRadialGradient(
    layout.gameArea.x + layout.gameArea.width / 2,
    layout.gameArea.y + layout.gameArea.height / 2,
    layout.gameArea.height * 0.12,
    layout.gameArea.x + layout.gameArea.width / 2,
    layout.gameArea.y + layout.gameArea.height / 2,
    layout.gameArea.width * 0.62,
  );
  gradient.addColorStop(0, 'rgba(98, 42, 132, 0)');
  gradient.addColorStop(1, `rgba(72, 20, 104, ${0.66 * visibility})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(layout.gameArea.x, layout.gameArea.y, layout.gameArea.width, layout.gameArea.height);

  const bannerWidth = Math.min(layout.gameArea.width * 0.68, 430);
  const bannerX = layout.gameArea.x + (layout.gameArea.width - bannerWidth) / 2;
  const bannerY = layout.gameArea.y + 12;
  ctx.fillStyle = `rgba(78, 35, 103, ${0.88 * visibility})`;
  ctx.beginPath();
  ctx.roundRect(bannerX, bannerY, bannerWidth, 44, 22);
  ctx.fill();
  ctx.fillStyle = `rgba(250, 226, 255, ${visibility})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.max(17, layout.tileWidth * 0.5)}px system-ui, sans-serif`;
  ctx.fillText('보스가 나타났어요!', bannerX + bannerWidth / 2, bannerY + 22);
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
  ctx.font = `800 ${Math.max(18, layout.tileWidth * 0.72)}px system-ui, sans-serif`;
  ctx.fillText('일시정지', gameArea.x + gameArea.width / 2, gameArea.y + gameArea.height / 2);
}
