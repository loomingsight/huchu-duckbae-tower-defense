import { GRID_HEIGHT, GRID_WIDTH } from '../game/config';
import type { CanvasLayout } from '../game/render/layout';
import type { Cell, Vec2 } from '../game/types';

export type ClientPoint = Readonly<{ x: number; y: number }>;

export type ClientRect = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

const TAP_DRAG_LIMIT_CSS_PIXELS = 8;

function defaultClientRect(layout: CanvasLayout): ClientRect {
  return {
    left: 0,
    top: 0,
    width: layout.viewport.width,
    height: layout.viewport.height,
  };
}

export function pointerToWorld(
  point: ClientPoint,
  layout: CanvasLayout,
  clientRect: ClientRect = defaultClientRect(layout),
): Vec2 | null {
  if (
    !Number.isFinite(point.x)
    || !Number.isFinite(point.y)
    || !Number.isFinite(clientRect.left)
    || !Number.isFinite(clientRect.top)
    || !Number.isFinite(clientRect.width)
    || !Number.isFinite(clientRect.height)
    || clientRect.width <= 0
    || clientRect.height <= 0
    || !Number.isFinite(layout.cellSize)
    || layout.cellSize <= 0
  ) {
    return null;
  }

  const canvasX = (point.x - clientRect.left) * (layout.viewport.width / clientRect.width);
  const canvasY = (point.y - clientRect.top) * (layout.viewport.height / clientRect.height);
  const x = (canvasX - layout.mapArea.x) / layout.cellSize;
  const y = (canvasY - layout.mapArea.y) / layout.cellSize;
  if (
    !Number.isFinite(x)
    || !Number.isFinite(y)
    || x < 0
    || x >= GRID_WIDTH
    || y < 0
    || y >= GRID_HEIGHT
  ) {
    return null;
  }

  return { x, y };
}

export function pointerToCell(
  point: ClientPoint,
  layout: CanvasLayout,
  clientRect?: ClientRect,
): Cell | null {
  const world = pointerToWorld(point, layout, clientRect);
  return world === null ? null : { col: Math.floor(world.x), row: Math.floor(world.y) };
}

export function isTapGesture(
  start: ClientPoint,
  end: ClientPoint,
  dragLimit = TAP_DRAG_LIMIT_CSS_PIXELS,
): boolean {
  if (
    !Number.isFinite(start.x)
    || !Number.isFinite(start.y)
    || !Number.isFinite(end.x)
    || !Number.isFinite(end.y)
    || !Number.isFinite(dragLimit)
    || dragLimit < 0
  ) {
    return false;
  }

  return Math.hypot(end.x - start.x, end.y - start.y) <= dragLimit;
}
