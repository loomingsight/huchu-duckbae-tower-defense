import { enemyPosition, selectTarget } from '../combat/targeting';
import { STAGE_1 } from '../map/stage1';
import type { GameEnemy, GameTower } from '../simulation/createGame';
import type { Vec2 } from '../types';
import type { GameAssets, LoadedSprite } from './assetLoader';
import type { CanvasLayout } from './layout';
import { worldToScreen } from './drawMap';
import type { SpriteDirection } from './spriteManifest';

export type RenderEntitiesSnapshot = {
  readonly enemies: readonly Readonly<GameEnemy>[];
  readonly towers: readonly Readonly<GameTower>[];
};

export function movementDirection(vector: Readonly<Vec2>): SpriteDirection {
  const x = Number.isFinite(vector.x) ? vector.x : 0;
  const y = Number.isFinite(vector.y) ? vector.y : 0;
  if (x === 0 && y === 0) return 'se';
  if (y === 0) return x < 0 ? 'sw' : 'ne';
  if (x === 0) return y < 0 ? 'nw' : 'se';
  if (x > 0) return y < 0 ? 'ne' : 'se';
  return y > 0 ? 'sw' : 'nw';
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

function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: LoadedSprite,
  center: Readonly<Vec2>,
  size: number,
  fallbackColor: string,
  fallbackLabel: string,
): void {
  if (image !== null) {
    ctx.drawImage(image, center.x - size / 2, center.y - size / 2, size, size);
    return;
  }

  const radius = size * 0.27;
  ctx.fillStyle = fallbackColor;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff9e8';
  ctx.font = `700 ${Math.max(8, size * 0.19)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fallbackLabel, center.x, center.y);
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
    ? { x: 1, y: 1 }
    : { x: position.x - tower.position.x, y: position.y - tower.position.y };
  return assets.towers.arrow[movementDirection(vector)];
}

function drawTowers(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  snapshot: RenderEntitiesSnapshot,
  assets: GameAssets,
): void {
  const labels = { slow: 'S', arrow: 'A', deokbae: 'D', huchu: 'H' } as const;
  const colors = {
    slow: '#7563c8',
    arrow: '#b68d48',
    deokbae: '#d9673d',
    huchu: '#35acc7',
  } as const;
  const towers = [...snapshot.towers].sort((left, right) => (
    left.position.y - right.position.y || left.id - right.id
  ));

  for (const tower of towers) {
    const center = worldToScreen(layout, tower.position);
    drawSprite(
      ctx,
      towerSprite(tower, snapshot, assets),
      center,
      layout.cellSize * 1.75,
      colors[tower.type],
      labels[tower.type],
    );
  }
}

function drawEnemyHp(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  enemy: Readonly<GameEnemy>,
  center: Readonly<Vec2>,
): void {
  const width = layout.cellSize * 0.72;
  const height = Math.max(3, layout.cellSize * 0.09);
  const x = center.x - width / 2;
  const y = center.y - layout.cellSize * 0.57;
  const hpRatio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));

  ctx.fillStyle = 'rgba(44, 38, 32, 0.72)';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = hpRatio > 0.45 ? '#7bd45d' : hpRatio > 0.2 ? '#f1c453' : '#ef665d';
  ctx.fillRect(x, y, width * hpRatio, height);
}

function drawEnemies(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  enemies: readonly Readonly<GameEnemy>[],
  assets: GameAssets,
): void {
  const sizes = { slime: 1.25, fairy: 1.28, orc: 1.38, golem: 1.5, minotaur: 1.72 } as const;
  const colors = {
    slime: '#78c96d',
    fairy: '#77cbd6',
    orc: '#5f9b56',
    golem: '#85877f',
    minotaur: '#9b6048',
  } as const;
  const visible = enemies
    .map((enemy) => ({ enemy, position: enemyPosition(enemy) }))
    .filter((item): item is { enemy: Readonly<GameEnemy>; position: Vec2 } => item.position !== undefined)
    .sort((left, right) => left.position.y - right.position.y || left.enemy.id - right.enemy.id);

  for (const { enemy, position } of visible) {
    const center = worldToScreen(layout, position);
    const direction = movementDirection(enemyMovement(enemy));
    drawSprite(
      ctx,
      assets.enemies[enemy.type][direction],
      center,
      layout.cellSize * sizes[enemy.type],
      colors[enemy.type],
      enemy.type.slice(0, 1).toUpperCase(),
    );
    drawEnemyHp(ctx, layout, enemy, center);
  }
}

export function drawEntities(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  snapshot: RenderEntitiesSnapshot,
  assets: GameAssets,
): void {
  drawTowers(ctx, layout, snapshot, assets);
  drawEnemies(ctx, layout, snapshot.enemies, assets);
}
