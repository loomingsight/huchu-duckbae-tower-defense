import { enemyPosition, selectTarget } from '../combat/targeting';
import { cellCenter } from '../core/geometry';
import type { GameEnemy, GameTower } from '../simulation/createGame';
import type { StageId } from '../stages/stageCatalog';
import type { TowerType } from '../towers/towerCatalog';
import type { Cell, Vec2 } from '../types';
import type { GameAssets, LoadedSprite } from './assetLoader';
import type { CanvasLayout } from './layout';
import {
  isRenderableWorldPoint,
  projectWorldPoint,
  visualScaleAt,
} from './projection';
import {
  MOTION_SPRITES,
  SPRITE_FRAME_SIZES,
  type SpriteDirection,
} from './spriteManifest';
import { drawSpriteFrame } from './spriteSheet';

export type RenderEntitiesSnapshot = {
  readonly stageId: StageId;
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

export function screenDiagonalDirection(vector: Readonly<Vec2>): SpriteDirection {
  const x = Number.isFinite(vector.x) ? vector.x : 0;
  const y = Number.isFinite(vector.y) ? vector.y : 0;
  if (x === 0 && y === 0) return 'se';
  if (x === 0) return y < 0 ? 'ne' : 'sw';
  if (y === 0) return x < 0 ? 'nw' : 'se';
  if (x > 0) return y < 0 ? 'ne' : 'se';
  return y < 0 ? 'nw' : 'sw';
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
  layout: CanvasLayout,
): LoadedSprite {
  if (tower.type !== 'arrow') return assets.towers[tower.type];
  const target = selectTarget(tower, snapshot.enemies, snapshot.stageId);
  const targetPosition = target === undefined
    ? undefined
    : enemyPosition(target, snapshot.stageId);
  if (targetPosition === undefined) return assets.towers.arrow.se;
  const towerScreen = projectWorldPoint(layout, tower.position);
  const targetScreen = projectWorldPoint(layout, targetPosition);
  return assets.towers.arrow[screenDiagonalDirection({
    x: targetScreen.x - towerScreen.x,
    y: targetScreen.y - towerScreen.y,
  })];
}

function drawEnemyHp(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  enemy: Readonly<GameEnemy>,
  position: Readonly<Vec2>,
  timeSeconds: number,
): void {
  const isBoss = enemy.type === 'minotaur';
  const recentlyHit = enemy.lastHitAtSeconds !== null
    && timeSeconds - enemy.lastHitAtSeconds <= 2.5;
  if (!isBoss && !recentlyHit) return;

  const center = projectWorldPoint(layout, position);
  const scale = visualScaleAt(layout, position.y);
  const width = layout.tileWidth * scale * (isBoss ? 1.35 : 0.9);
  const height = Math.max(4, layout.tileWidth * scale * 0.09);
  const x = center.x - width / 2;
  const y = center.y - layout.tileWidth * scale * (isBoss ? 1.24 : 1.02);
  const hpRatio = Number.isFinite(enemy.hp)
    && Number.isFinite(enemy.maxHp)
    && enemy.maxHp > 0
    ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp))
    : 0;

  if (isBoss) {
    ctx.fillStyle = '#f0d7ff';
    ctx.font = `900 ${Math.max(8, layout.tileWidth * scale * 0.2)}px system-ui, sans-serif`;
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
const TOWER_GROUND_ANCHOR_Y = {
  slow: 86 / 128,
  arrow: 82 / 128,
  deokbae: 80 / 128,
  huchu: 79 / 128,
} as const;
const ENEMY_SIZES = {
  slime: 2.05,
  fairy: 2.32,
  orc: 2.38,
  golem: 2.5,
  minotaur: 2.85,
} as const;
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

function compareBodies(layout: CanvasLayout, left: EntityBody, right: EntityBody): number {
  const leftY = projectWorldPoint(layout, left.position).y;
  const rightY = projectWorldPoint(layout, right.position).y;
  return leftY - rightY
    || (left.kind === right.kind ? 0 : left.kind === 'enemy' ? 1 : -1)
    || left.id - right.id;
}

function drawTowerBody(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  type: TowerType,
  sprite: LoadedSprite,
  cell: Readonly<Cell>,
  alpha: number,
): void {
  const ground = projectWorldPoint(layout, { x: cell.col + 0.5, y: cell.row + 1 });
  const size = layout.tileWidth * 2.0 * visualScaleAt(layout, cell.row + 0.5);
  ctx.save();
  ctx.translate(ground.x, ground.y);
  ctx.globalAlpha = alpha;
  drawAnchoredSprite(
    ctx,
    sprite,
    0,
    SPRITE_FRAME_SIZES.tower,
    size,
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
  const motion = enemy.type === 'orc'
    ? MOTION_SPRITES.orc
    : enemy.type === 'fairy' ? MOTION_SPRITES.fairy : null;
  const framePhase = timeSeconds * (motion?.fps ?? 7) + enemy.id * 0.37;
  const bobPhase = timeSeconds * (motion?.fps ?? 7) * 0.5 + enemy.id * 0.37;
  const frame = motion === null ? 0 : Math.floor(framePhase) % motion.frames;
  const sprite = motion === null
    ? assets.enemies[enemy.type].se
    : assets.motion[enemy.type as 'orc' | 'fairy'];
  const depthScale = visualScaleAt(layout, position.y);
  const wave = Math.sin(bobPhase * Math.PI * 2);
  const bounce = wave
    * layout.tileHeight
    * depthScale
    * (enemy.type === 'fairy' ? 0.22 : 0.09);
  const squash = enemy.type === 'slime' ? 1 + wave * 0.08 : 1;
  const center = projectWorldPoint(layout, position);

  ctx.save();
  ctx.translate(center.x, center.y - bounce);
  ctx.scale(1 / squash, squash);
  drawAnchoredSprite(
    ctx,
    sprite,
    frame,
    motion === null ? SPRITE_FRAME_SIZES.enemy : SPRITE_FRAME_SIZES.motion,
    layout.tileWidth * ENEMY_SIZES[enemy.type] * depthScale,
    ENEMY_COLORS[enemy.type],
    enemy.type.slice(0, 1).toUpperCase(),
    enemy.type === 'orc' ? 0.60 : 0.76,
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
    if (isRenderableWorldPoint(layout, tower.position)) {
      bodies.push({ kind: 'tower', id: tower.id, position: tower.position, tower });
    }
  }
  for (const enemy of snapshot.enemies) {
    const position = enemyPosition(enemy, snapshot.stageId);
    if (position !== undefined && isRenderableWorldPoint(layout, position)) {
      bodies.push({ kind: 'enemy', id: enemy.id, position, enemy });
    }
  }
  const preview = options.previewTower;
  if (preview !== null && preview !== undefined) {
    const position = cellCenter(preview.cell);
    if (isRenderableWorldPoint(layout, position)) {
      bodies.push({ kind: 'preview', id: Number.MAX_SAFE_INTEGER, position, preview });
    }
  }
  bodies.sort((left, right) => compareBodies(layout, left, right));

  const timeSeconds = Number.isFinite(options.timeSeconds) ? options.timeSeconds ?? 0 : 0;
  for (const body of bodies) {
    if (body.kind === 'enemy' && body.enemy !== undefined) {
      drawEnemyBody(ctx, layout, body.enemy, body.position, assets, timeSeconds);
    } else if (body.kind === 'tower' && body.tower !== undefined) {
      drawTowerBody(
        ctx,
        layout,
        body.tower.type,
        towerSprite(body.tower, snapshot, assets, layout),
        body.tower.cell,
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
        body.preview.cell,
        body.preview.valid ? 0.68 : 0.38,
      );
    }
  }

  for (const body of bodies) {
    if (body.kind === 'enemy' && body.enemy !== undefined) {
      drawEnemyHp(ctx, layout, body.enemy, body.position, timeSeconds);
    }
  }
}
