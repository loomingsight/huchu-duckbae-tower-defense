import { GRID_HEIGHT, GRID_WIDTH } from '../config';
import type { Cell, Vec2 } from '../types';
import type { CanvasLayout } from './layout';
import { alignToDevicePixel } from './layout';

export type ScreenPoint = Readonly<{ x: number; y: number }>;
export type CellPolygon = readonly [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];

const CHARACTER_BASE_SCALE = 1.25;

function finitePoint(point: Readonly<Vec2>): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function perspectiveScaleAt(layout: CanvasLayout, row: number): number {
  if (!Number.isFinite(row)) return Number.NaN;
  const depth = Math.max(0, Math.min(1, row / GRID_HEIGHT));
  return layout.projection.farScale
    + (layout.projection.nearScale - layout.projection.farScale) * depth;
}

export function visualScaleAt(layout: CanvasLayout, row: number): number {
  return CHARACTER_BASE_SCALE * perspectiveScaleAt(layout, row);
}

export function projectWorldPoint(
  layout: CanvasLayout,
  point: Readonly<Vec2>,
): ScreenPoint {
  if (!finitePoint(point)) return { x: Number.NaN, y: Number.NaN };
  const scale = perspectiveScaleAt(layout, point.y);
  const x = layout.projection.centerX
    + (point.x - GRID_WIDTH / 2) * layout.projection.baseCellWidth * scale;
  const y = layout.projection.topY + point.y * layout.projection.rowStep;
  return {
    x: alignToDevicePixel(x, layout.dpr),
    y: alignToDevicePixel(y, layout.dpr),
  };
}

export function projectCellPolygon(
  layout: CanvasLayout,
  cell: Readonly<Cell>,
): CellPolygon {
  return [
    projectWorldPoint(layout, { x: cell.col, y: cell.row }),
    projectWorldPoint(layout, { x: cell.col + 1, y: cell.row }),
    projectWorldPoint(layout, { x: cell.col + 1, y: cell.row + 1 }),
    projectWorldPoint(layout, { x: cell.col, y: cell.row + 1 }),
  ];
}

export function unprojectScreenPoint(
  layout: CanvasLayout,
  point: ScreenPoint,
): Vec2 | null {
  if (!finitePoint(point)) return null;
  const row = (point.y - layout.projection.topY) / layout.projection.rowStep;
  const scale = perspectiveScaleAt(layout, row);
  const col = GRID_WIDTH / 2
    + (point.x - layout.projection.centerX) / (layout.projection.baseCellWidth * scale);
  if (
    !Number.isFinite(col)
    || !Number.isFinite(row)
    || col < 0
    || col >= GRID_WIDTH
    || row < 0
    || row >= GRID_HEIGHT
  ) return null;
  return { x: col, y: row };
}

export function isScreenPointInsidePolygon(
  point: ScreenPoint,
  polygon: readonly ScreenPoint[],
): boolean {
  if (
    !finitePoint(point)
    || polygon.length < 3
    || polygon.some((vertex) => !finitePoint(vertex))
  ) return false;

  let sign = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const cross = (next.x - current.x) * (point.y - current.y)
      - (next.y - current.y) * (point.x - current.x);
    if (Math.abs(cross) <= 1e-7) continue;
    const currentSign = Math.sign(cross);
    if (sign !== 0 && currentSign !== sign) return false;
    sign = currentSign;
  }
  return true;
}

export function projectWorldRing(
  layout: CanvasLayout,
  center: Readonly<Vec2>,
  radius: number,
  segments = 48,
): readonly ScreenPoint[] {
  if (!finitePoint(center) || !Number.isFinite(radius) || radius <= 0) return [];
  const requestedSegments = Number.isFinite(segments) ? segments : 48;
  const count = Math.max(8, Math.min(128, Math.floor(requestedSegments)));
  const points = Array.from({ length: count }, (_, index) => {
    const angle = index / count * Math.PI * 2;
    return projectWorldPoint(layout, {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  });
  return points.every(finitePoint) ? points : [];
}

export function isRenderableWorldPoint(
  layout: CanvasLayout,
  point: Readonly<Vec2>,
): boolean {
  if (!finitePoint(point)) return false;
  const screen = projectWorldPoint(layout, point);
  if (!finitePoint(screen)) return false;
  const margin = layout.tileWidth * 4;
  return screen.x >= layout.gameArea.x - margin
    && screen.x <= layout.gameArea.x + layout.gameArea.width + margin
    && screen.y >= layout.gameArea.y - margin
    && screen.y <= layout.gameArea.y + layout.gameArea.height + margin;
}
