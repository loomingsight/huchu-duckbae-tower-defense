import { cellCenter } from '../core/geometry';
import { STAGE_1 } from '../map/stage1';
import type { Cell } from '../types';
import type { CanvasLayout } from './layout';
import { alignToDevicePixel } from './layout';

const COLORS = {
  ground: '#6e9870',
  grid: 'rgba(40, 75, 54, 0.24)',
  road: '#d8bd82',
  roadEdge: '#ad925d',
  selected: 'rgba(70, 209, 230, 0.34)',
  selectedEdge: '#40cbe2',
  range: 'rgba(75, 204, 225, 0.18)',
  rangeEdge: 'rgba(33, 149, 177, 0.7)',
} as const;

export type MapSelection = {
  cell?: Readonly<Cell> | null;
  range?: number;
};

export type ScreenPoint = { x: number; y: number };

export function isFinitePoint(point: Readonly<{ x: number; y: number }>): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function isRenderablePoint(
  layout: CanvasLayout,
  point: Readonly<{ x: number; y: number }>,
): boolean {
  return isFinitePoint(point)
    && Number.isFinite(layout.mapArea.x + point.x * layout.cellSize)
    && Number.isFinite(layout.mapArea.y + point.y * layout.cellSize);
}

export function worldToScreen(
  layout: CanvasLayout,
  point: Readonly<{ x: number; y: number }>,
): ScreenPoint {
  const x = Number.isFinite(point.x) ? point.x : 0;
  const y = Number.isFinite(point.y) ? point.y : 0;
  const screenX = layout.mapArea.x + x * layout.cellSize;
  const screenY = layout.mapArea.y + y * layout.cellSize;
  return {
    x: alignToDevicePixel(Number.isFinite(screenX) ? screenX : layout.mapArea.x, layout.dpr),
    y: alignToDevicePixel(Number.isFinite(screenY) ? screenY : layout.mapArea.y, layout.dpr),
  };
}

function cellEdges(layout: CanvasLayout, cell: Readonly<Cell>) {
  const left = alignToDevicePixel(
    layout.mapArea.x + cell.col * layout.cellSize,
    layout.dpr,
  );
  const top = alignToDevicePixel(
    layout.mapArea.y + cell.row * layout.cellSize,
    layout.dpr,
  );
  const right = alignToDevicePixel(
    layout.mapArea.x + (cell.col + 1) * layout.cellSize,
    layout.dpr,
  );
  const bottom = alignToDevicePixel(
    layout.mapArea.y + (cell.row + 1) * layout.cellSize,
    layout.dpr,
  );
  return { left, top, right, bottom };
}

function drawEntry(ctx: CanvasRenderingContext2D, layout: CanvasLayout): void {
  const startCell = STAGE_1.pathCells[0];
  const center = worldToScreen(layout, cellCenter(startCell));
  const size = layout.cellSize;

  ctx.save();
  ctx.fillStyle = 'rgba(42, 83, 57, 0.88)';
  ctx.beginPath();
  ctx.moveTo(center.x - size * 0.3, center.y - size * 0.2);
  ctx.lineTo(center.x + size * 0.12, center.y - size * 0.2);
  ctx.lineTo(center.x + size * 0.12, center.y - size * 0.36);
  ctx.lineTo(center.x + size * 0.38, center.y);
  ctx.lineTo(center.x + size * 0.12, center.y + size * 0.36);
  ctx.lineTo(center.x + size * 0.12, center.y + size * 0.2);
  ctx.lineTo(center.x - size * 0.3, center.y + size * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSnackGoal(ctx: CanvasRenderingContext2D, layout: CanvasLayout): void {
  const goalCell = STAGE_1.pathCells[STAGE_1.pathCells.length - 1];
  const center = worldToScreen(layout, cellCenter(goalCell));
  const size = layout.cellSize;
  const width = size * 0.68;
  const height = size * 0.52;

  ctx.save();
  ctx.fillStyle = '#8b5b37';
  ctx.fillRect(center.x - width / 2, center.y - height / 2, width, height);
  ctx.fillStyle = '#bc8050';
  ctx.fillRect(center.x - width / 2, center.y - height / 2, width, height * 0.32);
  ctx.strokeStyle = '#5d3b27';
  ctx.lineWidth = Math.max(1, size * 0.045);
  ctx.strokeRect(center.x - width / 2, center.y - height / 2, width, height);
  ctx.fillStyle = '#f4d96c';
  ctx.fillRect(center.x - size * 0.07, center.y - size * 0.06, size * 0.14, size * 0.14);
  ctx.restore();
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  selection: MapSelection,
): void {
  if (selection.cell == null) return;
  const { cell } = selection;
  if (
    !Number.isInteger(cell.col)
    || !Number.isInteger(cell.row)
    || cell.col < 0
    || cell.col >= STAGE_1.width
    || cell.row < 0
    || cell.row >= STAGE_1.height
  ) {
    return;
  }

  const edges = cellEdges(layout, cell);
  if (
    selection.range !== undefined
    && Number.isFinite(selection.range)
    && selection.range > 0
  ) {
    const center = worldToScreen(layout, cellCenter(cell));
    const radius = selection.range * layout.cellSize;
    if (Number.isFinite(radius)) {
      ctx.fillStyle = COLORS.range;
      ctx.strokeStyle = COLORS.rangeEdge;
      ctx.lineWidth = Math.max(1, 1 / layout.dpr);
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.fillStyle = COLORS.selected;
  ctx.fillRect(edges.left, edges.top, edges.right - edges.left, edges.bottom - edges.top);
  ctx.strokeStyle = COLORS.selectedEdge;
  ctx.lineWidth = Math.max(2, 2 / layout.dpr);
  ctx.strokeRect(edges.left, edges.top, edges.right - edges.left, edges.bottom - edges.top);
}

export function drawMap(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  selection: MapSelection = {},
): void {
  const { mapArea } = layout;
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(mapArea.x, mapArea.y, mapArea.width, mapArea.height);

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = Math.max(0.75, 1 / layout.dpr);
  ctx.beginPath();
  for (let col = 0; col <= STAGE_1.width; col += 1) {
    const x = alignToDevicePixel(mapArea.x + col * layout.cellSize, layout.dpr);
    ctx.moveTo(x, mapArea.y);
    ctx.lineTo(x, mapArea.y + mapArea.height);
  }
  for (let row = 0; row <= STAGE_1.height; row += 1) {
    const y = alignToDevicePixel(mapArea.y + row * layout.cellSize, layout.dpr);
    ctx.moveTo(mapArea.x, y);
    ctx.lineTo(mapArea.x + mapArea.width, y);
  }
  ctx.stroke();

  // Cover grid lines with one uninterrupted sand tone so the road stays unpatterned.
  ctx.fillStyle = COLORS.road;
  for (const cell of STAGE_1.pathCells) {
    const edges = cellEdges(layout, cell);
    ctx.fillRect(edges.left, edges.top, edges.right - edges.left, edges.bottom - edges.top);
  }

  ctx.strokeStyle = COLORS.roadEdge;
  ctx.lineWidth = Math.max(1, 1 / layout.dpr);
  ctx.strokeRect(mapArea.x, mapArea.y, mapArea.width, mapArea.height);

  drawSelection(ctx, layout, selection);
  drawEntry(ctx, layout);
  drawSnackGoal(ctx, layout);
}
