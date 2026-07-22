import { cellCenter } from '../core/geometry';
import type { StageMap } from '../map/createStageMap';
import type { Cell } from '../types';
import type { GameAssets, LoadedSprite } from './assetLoader';
import type { CanvasLayout } from './layout';
import {
  projectCellPolygon,
  projectWorldPoint,
  projectWorldRing,
  visualScaleAt,
  type ScreenPoint,
} from './projection';
import { drawSpriteFrame } from './spriteSheet';

const COLORS = {
  ground: '#17382f',
  grass: '#4f8c65',
  grassAlternate: '#5d9a70',
  road: '#e4c99f',
  boardSide: '#2f6247',
  grid: 'rgba(36, 74, 61, 0.3)',
  selected: 'rgba(50, 218, 220, 0.38)',
  selectedEdge: '#5ce1e6',
  invalid: 'rgba(255, 92, 92, 0.42)',
  invalidEdge: '#ff8b82',
  range: 'rgba(76, 214, 222, 0.13)',
  rangeEdge: 'rgba(94, 228, 232, 0.62)',
  placementGuide: 'rgba(54, 145, 255, 0.28)',
} as const;

export type MapSelection = {
  buildableCells?: readonly Readonly<Cell>[];
  cell?: Readonly<Cell> | null;
  range?: number;
  valid?: boolean;
};

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

function traceCell(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  cell: Readonly<Cell>,
): boolean {
  return tracePoints(ctx, projectCellPolygon(layout, cell));
}

function drawBoardThickness(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  map: StageMap,
): void {
  const left = projectWorldPoint(layout, { x: 0, y: map.height });
  const right = projectWorldPoint(layout, { x: map.width, y: map.height });
  const thickness = Math.max(5, layout.projection.rowStep * 0.22);
  if (!tracePoints(ctx, [
    left,
    right,
    { x: right.x, y: right.y + thickness },
    { x: left.x, y: left.y + thickness },
  ])) return;
  ctx.fillStyle = COLORS.boardSide;
  ctx.fill();
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  cell: Readonly<Cell>,
  isRoad: boolean,
): void {
  if (!traceCell(ctx, layout, cell)) return;
  ctx.fillStyle = isRoad
    ? COLORS.road
    : cell.row % 2 === 0 ? COLORS.grass : COLORS.grassAlternate;
  ctx.fill();
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = Math.max(0.5, 1 / layout.dpr);
  ctx.stroke();
}

function drawPlacementGuide(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  map: StageMap,
  cells: readonly Readonly<Cell>[],
): void {
  for (const cell of cells) {
    if (
      !Number.isInteger(cell.col)
      || !Number.isInteger(cell.row)
      || cell.col < 0
      || cell.col >= map.width
      || cell.row < 0
      || cell.row >= map.height
      || !traceCell(ctx, layout, cell)
    ) continue;
    ctx.fillStyle = COLORS.placementGuide;
    ctx.fill();
  }
}

function drawLandmark(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  image: LoadedSprite,
  cell: Readonly<Cell>,
  sizeFactor: number,
  groundAnchor: number,
): void {
  const ground = projectWorldPoint(layout, { x: cell.col + 0.5, y: cell.row + 1 });
  const size = layout.tileWidth * sizeFactor * visualScaleAt(layout, cell.row + 0.5);
  drawSpriteFrame(ctx, image, 0, 128, {
    x: ground.x - size / 2,
    y: ground.y - size * groundAnchor,
    width: size,
    height: size,
  });
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  map: StageMap,
  selection: MapSelection,
): void {
  if (selection.cell == null) return;
  const { cell } = selection;
  if (
    !Number.isInteger(cell.col)
    || !Number.isInteger(cell.row)
    || cell.col < 0
    || cell.col >= map.width
    || cell.row < 0
    || cell.row >= map.height
  ) return;

  if (selection.range !== undefined && Number.isFinite(selection.range) && selection.range > 0) {
    const center = cellCenter(cell);
    for (let row = 0; row < map.height; row += 1) {
      for (let col = 0; col < map.width; col += 1) {
        if (Math.hypot(col - cell.col, row - cell.row) > selection.range) continue;
        if (!traceCell(ctx, layout, { col, row })) continue;
        ctx.fillStyle = COLORS.range;
        ctx.fill();
      }
    }
    if (tracePoints(ctx, projectWorldRing(layout, center, selection.range))) {
      ctx.strokeStyle = COLORS.rangeEdge;
      ctx.lineWidth = Math.max(1, 1 / layout.dpr);
      ctx.stroke();
    }
  }

  if (!traceCell(ctx, layout, cell)) return;
  ctx.fillStyle = selection.valid === false ? COLORS.invalid : COLORS.selected;
  ctx.fill();
  ctx.strokeStyle = selection.valid === false ? COLORS.invalidEdge : COLORS.selectedEdge;
  ctx.lineWidth = Math.max(2, 2 / layout.dpr);
  ctx.stroke();
}

export function drawMap(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  assets: GameAssets,
  map: StageMap,
  selection: MapSelection = {},
): void {
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(
    layout.gameArea.x,
    layout.gameArea.y,
    layout.gameArea.width,
    layout.gameArea.height,
  );
  drawBoardThickness(ctx, layout, map);

  for (let row = 0; row < map.height; row += 1) {
    for (let col = 0; col < map.width; col += 1) {
      drawCell(ctx, layout, { col, row }, map.isPathCell({ col, row }));
    }
  }

  drawPlacementGuide(ctx, layout, map, selection.buildableCells ?? []);
  const chest = map.pathCells[map.pathCells.length - 1];
  drawLandmark(ctx, layout, assets.map.snackChest, chest, 2.05, 0.86);
  drawSelection(ctx, layout, map, selection);
}
