import type { CanvasLayout } from '../game/render/layout';
import {
  isScreenPointInsidePolygon,
  projectCellPolygon,
  unprojectScreenPoint,
} from '../game/render/projection';
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
  ) {
    return null;
  }

  const screen = {
    x: (point.x - clientRect.left) * (layout.viewport.width / clientRect.width),
    y: (point.y - clientRect.top) * (layout.viewport.height / clientRect.height),
  };
  return unprojectScreenPoint(layout, screen);
}

export function pointerToCell(
  point: ClientPoint,
  layout: CanvasLayout,
  clientRect: ClientRect = defaultClientRect(layout),
): Cell | null {
  const world = pointerToWorld(point, layout, clientRect);
  if (world === null) return null;
  const cell = { col: Math.floor(world.x), row: Math.floor(world.y) };
  const screen = {
    x: (point.x - clientRect.left) * (layout.viewport.width / clientRect.width),
    y: (point.y - clientRect.top) * (layout.viewport.height / clientRect.height),
  };
  return isScreenPointInsidePolygon(screen, projectCellPolygon(layout, cell)) ? cell : null;
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
