import { enemyPosition, selectTarget } from '../combat/targeting';
import { STAGE_1 } from '../map/stage1';
import type { GameEnemy, GameTower } from '../simulation/createGame';
import type { TowerType } from '../towers/towerCatalog';
import type { Cell, Vec2 } from '../types';
import { cellCenter } from '../core/geometry';
import type { GameAssets, LoadedSprite } from './assetLoader';
import type { CanvasLayout } from './layout';
import { isRenderablePoint, worldToScreen } from './drawMap';
import { MOTION_SPRITES, type SpriteDirection } from './spriteManifest';
import { drawSpriteFrame } from './spriteSheet';

export type RenderEntitiesSnapshot = {
  readonly enemies: readonly Readonly<GameEnemy>[];
  readonly towers: readonly Readonly<GameTower>[];
};

export type TowerPreview = Readonly<{
  type: TowerType;
  cell: Readonly<Cell>;
  valid: boolean;
}>;

export type DrawEntitiesOptions = Readonly<{
  timeSeconds?: number;
  previewTower?: TowerPreview | null;
}>;

export function movementDirection(vector: Readonly<Vec2>): SpriteDirection {
  const x = Number.isFinite(vector.x) ? vector.x : 0;
  const y = Number.isFinite(vector.y) ? vector.y : 0;
  if (x === 0 && y === 0) return 'se';
  const screenX = x - y;
  const screenY = x + y;
  if (screenX === 0) return screenY < 0 ? 'nw' : 'se';
  if (screenY === 0) return screenX < 0 ? 'sw' : 'ne';
  if (screenX > 0) return screenY < 0 ? 'ne' : 'se';
  return screenY < 0 ? 'nw' : 'sw';
}

function enemyMovement(enemy: Readonly<GameEnemy>): Vec2 {
  const lastIndex = STAGE_1.pathCells.length - 1;
  const progress = Number.isFinite(enemy.progress)
    ? Math.max(0, Math.min(enemy.progress, lastIndex))
    : 0;
  const currentIndex = Math.min(Math.floor(progress), lastIndex - 1);
  const current = STAGE_1.pathCells[currentIndex];
  const next = STAGE_1.pathCells[currentIndex + 1];
  return { x: next.col - current.col, y: next.row - current.row };
}

function drawFallback(
  ctx: CanvasRenderingContext2D,
  color: string,
  label: string,
  size: number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.23, size * 0.28, size * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff9e8';
  ctx.font = `800 ${Math.max(8, size * 0.17)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, -size * 0.24);
}

function drawAnchoredSprite(
  ctx: CanvasRenderingContext2D,
  image: LoadedSprite,
  frameIndex: number,
  frameSize: number,
  size: number,
  fallbackColor: string,
  fallbackLabel: string,
  groundAnchorY = 0.76,
): void {
  if (!drawSpriteFrame(ctx, image, frameIndex, frameSize, {
    x: -size / 2,
    y: -size * groundAnchorY,
    width: size,
    height: size,
  })) drawFallback(ctx, fallbackColor, fallbackLabel, size);
}

function towerSprite(
  tower: Readonly<GameTower>,
  snapshot: RenderEntitiesSnapshot,
  assets: GameAssets,
): LoadedSprite {
  if (tower.type !== 'arrow') return assets.towers[tower.type];
  const target = selectTarget(tower, snapshot.enemies);
  const position = target === undefined ? undefined : enemyPosition(target);
  const vector = position === undefined
    ? { x: 0, y: 1 }
    : { x: position.x - tower.position.x, y: position.y - tower.position.y };
  return assets.towers.arrow[movementDirection(vector)];
}

function drawEnemyHp(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  enemy: Readonly<GameEnemy>,
  center: Readonly<Vec2>,
  timeSeconds: number,
): void {
  const isBoss = enemy.type === 'minotaur';
  const recentlyHit = enemy.lastHitAtSeconds !== null
    && timeSeconds - enemy.lastHitAtSeconds <= 2.5;
  if (!isBoss && !recentlyHit) return;

  const width = layout.tileWidth * (isBoss ? 1.35 : 0.9);
  const height = Math.max(4, layout.tileWidth * 0.09);
  const x = center.x - width / 2;
  const y = center.y - layout.tileWidth * (isBoss ? 1.24 : 1.02);
  const hpRatio = Number.isFinite(enemy.hp)
    && Number.isFinite(enemy.maxHp)
    && enemy.maxHp > 0
    ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp))
    : 0;

  if (isBoss) {
    ctx.fillStyle = '#f0d7ff';
    ctx.font = `900 ${Math.max(8, layout.tileWidth * 0.2)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('BOSS', center.x, y - 2);
  }
  ctx.fillStyle = isBoss ? 'rgba(38, 19, 53, 0.9)' : 'rgba(44, 38, 32, 0.78)';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = isBoss
    ? '#b96cff'
    : hpRatio > 0.45 ? '#7bd45d' : hpRatio > 0.2 ? '#f1c453' : '#ef665d';
  ctx.fillRect(x, y, width * hpRatio, height);
}

const TOWER_LABELS = { slow: 'S', arrow: 'A', deokbae: 'D', huchu: 'H' } as const;
const TOWER_COLORS = {
  slow: '#7563c8',
  arrow: '#b68d48',
  deokbae: '#d9673d',
  huchu: '#35acc7',
} as const;
// Bottom-most visible pixel in each approved 128px tower render.
const TOWER_GROUND_ANCHOR_Y = {
  slow: 86 / 128,
  arrow: 82 / 128,
  deokbae: 80 / 128,
  huchu: 79 / 128,
} as const;
const ENEMY_SIZES = { slime: 2.05, fairy: 2.32, orc: 2.38, golem: 2.5, minotaur: 2.85 } as const;
const ENEMY_COLORS = {
  slime: '#78c96d',
  fairy: '#77cbd6',
  orc: '#5f9b56',
  golem: '#85877f',
  minotaur: '#9b6048',
} as const;

type EntityBody = Readonly<{
  kind: 'tower' | 'enemy' | 'preview';
  id: number;
  position: Readonly<Vec2>;
  tower?: Readonly<GameTower>;
  enemy?: Readonly<GameEnemy>;
  preview?: TowerPreview;
}>;

function compareBodies(left: EntityBody, right: EntityBody): number {
  return (left.position.x + left.position.y) - (right.position.x + right.position.y)
    || (left.kind === right.kind ? 0 : left.kind === 'enemy' ? 1 : -1)
    || left.id - right.id;
}

function drawTowerBody(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  type: TowerType,
  sprite: LoadedSprite,
  center: Readonly<Vec2>,
  alpha: number,
): void {
  ctx.save();
  ctx.translate(center.x, center.y + layout.tileHeight / 2);
  ctx.globalAlpha = alpha;
  drawAnchoredSprite(
    ctx,
    sprite,
    0,
    128,
    layout.tileWidth * 2.6,
    TOWER_COLORS[type],
    TOWER_LABELS[type],
    TOWER_GROUND_ANCHOR_Y[type],
  );
  ctx.restore();
}

function drawEnemyBody(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  enemy: Readonly<GameEnemy>,
  position: Readonly<Vec2>,
  assets: GameAssets,
  timeSeconds: number,
): void {
  const direction = movementDirection(enemyMovement(enemy));
  const motion = enemy.type === 'orc'
    ? MOTION_SPRITES.orc
    : enemy.type === 'fairy' ? MOTION_SPRITES.fairy : null;
  const useMotionSheet = direction === 'se' && motion !== null;
  const phase = timeSeconds * (motion?.fps ?? 7) + enemy.id * 0.37;
  const frame = useMotionSheet ? Math.floor(phase) % motion.frames : 0;
  const sprite = useMotionSheet
    ? assets.motion[enemy.type as 'orc' | 'fairy']
    : assets.enemies[enemy.type][direction];
  const bounce = Math.sin(phase * Math.PI * 2) * layout.tileHeight * (enemy.type === 'fairy' ? 0.22 : 0.09);
  const squash = enemy.type === 'slime' ? 1 + Math.sin(phase * Math.PI * 2) * 0.08 : 1;
  const center = worldToScreen(layout, position);

  ctx.save();
  ctx.translate(center.x, center.y - bounce);
  ctx.scale(1 / squash, squash);
  drawAnchoredSprite(
    ctx,
    sprite,
    frame,
    useMotionSheet ? 128 : 96,
    layout.tileWidth * ENEMY_SIZES[enemy.type],
    ENEMY_COLORS[enemy.type],
    enemy.type.slice(0, 1).toUpperCase(),
  );
  ctx.restore();
}

export function drawEntities(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  snapshot: RenderEntitiesSnapshot,
  assets: GameAssets,
  options: DrawEntitiesOptions = {},
): void {
  const bodies: EntityBody[] = [];
  for (const tower of snapshot.towers) {
    if (isRenderablePoint(layout, tower.position)) {
      bodies.push({ kind: 'tower', id: tower.id, position: tower.position, tower });
    }
  }
  for (const enemy of snapshot.enemies) {
    const position = enemyPosition(enemy);
    if (position !== undefined && isRenderablePoint(layout, position)) {
      bodies.push({ kind: 'enemy', id: enemy.id, position, enemy });
    }
  }
  const preview = options.previewTower;
  if (preview !== null && preview !== undefined) {
    const position = cellCenter(preview.cell);
    if (isRenderablePoint(layout, position)) {
      bodies.push({ kind: 'preview', id: Number.MAX_SAFE_INTEGER, position, preview });
    }
  }
  bodies.sort(compareBodies);

  const timeSeconds = Number.isFinite(options.timeSeconds) ? options.timeSeconds ?? 0 : 0;
  for (const body of bodies) {
    const center = worldToScreen(layout, body.position);
    if (body.kind === 'enemy' && body.enemy !== undefined) {
      drawEnemyBody(ctx, layout, body.enemy, body.position, assets, timeSeconds);
    } else if (body.kind === 'tower' && body.tower !== undefined) {
      drawTowerBody(
        ctx,
        layout,
        body.tower.type,
        towerSprite(body.tower, snapshot, assets),
        center,
        1,
      );
    } else if (body.preview !== undefined) {
      const sprite = body.preview.type === 'arrow'
        ? assets.towers.arrow.se
        : assets.towers[body.preview.type];
      drawTowerBody(
        ctx,
        layout,
        body.preview.type,
        sprite,
        center,
        body.preview.valid ? 0.68 : 0.38,
      );
    }
  }

  for (const body of bodies) {
    if (body.kind === 'enemy' && body.enemy !== undefined) {
      drawEnemyHp(
        ctx,
        layout,
        body.enemy,
        worldToScreen(layout, body.position),
        timeSeconds,
      );
    }
  }
}
