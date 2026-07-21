import { describe, expect, it } from 'vitest';

import {
  isTapGesture,
  pointerToCell,
  pointerToWorld,
} from '../../src/app/input';
import { computeCanvasLayout } from '../../src/game/render/layout';
import { projectWorldPoint } from '../../src/game/render/projection';

describe('mobile canvas input', () => {
  it('converts scaled client coordinates through the shared inverse projection', () => {
    const layout = computeCanvasLayout({ width: 400, height: 300, dpr: 2 });
    const canvasRect = { left: 50, top: 20, width: 800, height: 600 };

    const world = { x: 2.5, y: 4.5 };
    const screen = projectWorldPoint(layout, world);
    const point = {
      x: canvasRect.left + screen.x * 2,
      y: canvasRect.top + screen.y * 2,
    };

    const converted = pointerToWorld(point, layout, canvasRect);
    expect(converted?.x).toBeCloseTo(world.x, 1);
    expect(converted?.y).toBeCloseTo(world.y, 1);
    expect(pointerToCell(point, layout, canvasRect)).toEqual({ col: 2, row: 4 });
  });

  it('rejects the wide map bounds outside the narrow top trapezoid and invalid inputs', () => {
    const layout = computeCanvasLayout({ width: 400, height: 300, dpr: 1 });
    const topOutside = {
      x: layout.mapArea.x + 1,
      y: layout.projection.topY + 1,
    };

    expect(pointerToCell(topOutside, layout)).toBeNull();
    expect(pointerToCell({ x: 10, y: 10 }, layout)).toBeNull();
    expect(pointerToCell({ x: Number.NaN, y: 100 }, layout)).toBeNull();
    expect(pointerToCell({ x: 100, y: Number.POSITIVE_INFINITY }, layout)).toBeNull();
  });

  it('accepts an eight CSS pixel tap and cancels longer drags', () => {
    expect(isTapGesture({ x: 10, y: 10 }, { x: 18, y: 10 })).toBe(true);
    expect(isTapGesture({ x: 10, y: 10 }, { x: 18.01, y: 10 })).toBe(false);
    expect(isTapGesture({ x: Number.NaN, y: 10 }, { x: 10, y: 10 })).toBe(false);
  });
});
