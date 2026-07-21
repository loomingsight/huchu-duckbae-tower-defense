import { describe, expect, it } from 'vitest';

import {
  isTapGesture,
  pointerToCell,
  pointerToWorld,
} from '../../src/app/input';
import { computeCanvasLayout } from '../../src/game/render/layout';

describe('mobile canvas input', () => {
  it('converts client coordinates through the canvas rect and map letterbox', () => {
    const layout = computeCanvasLayout({ width: 400, height: 300, dpr: 2 });
    const canvasRect = { left: 50, top: 20, width: 800, height: 600 };

    const world = { x: 2.5, y: 4.5 };
    const screen = {
      x: layout.mapOrigin.x + (world.x - world.y) * layout.tileWidth / 2,
      y: layout.mapOrigin.y + (world.x + world.y) * layout.tileHeight / 2,
    };
    const point = {
      x: canvasRect.left + screen.x * 2,
      y: canvasRect.top + screen.y * 2,
    };

    const converted = pointerToWorld(point, layout, canvasRect);
    expect(converted?.x).toBeCloseTo(2.5, 10);
    expect(converted?.y).toBeCloseTo(4.5, 10);
    expect(pointerToCell(point, layout, canvasRect)).toEqual({ col: 2, row: 4 });
  });

  it('returns null for letterbox, outside-map, and non-finite coordinates', () => {
    const layout = computeCanvasLayout({ width: 400, height: 300, dpr: 1 });

    expect(pointerToCell({ x: 10, y: 10 }, layout)).toBeNull();
    expect(pointerToCell({ x: 200, y: 290 }, layout)).toBeNull();
    expect(pointerToCell({ x: Number.NaN, y: 100 }, layout)).toBeNull();
    expect(pointerToCell({ x: 100, y: Number.POSITIVE_INFINITY }, layout)).toBeNull();
  });

  it('accepts an eight CSS pixel tap and cancels longer drags', () => {
    expect(isTapGesture({ x: 10, y: 10 }, { x: 18, y: 10 })).toBe(true);
    expect(isTapGesture({ x: 10, y: 10 }, { x: 18.01, y: 10 })).toBe(false);
    expect(isTapGesture({ x: Number.NaN, y: 10 }, { x: 10, y: 10 })).toBe(false);
  });
});
