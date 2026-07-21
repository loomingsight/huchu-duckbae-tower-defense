import { describe, expect, it } from 'vitest';

import { GRID_HEIGHT, GRID_WIDTH } from '../../src/game/config';
import { computeCanvasLayout } from '../../src/game/render/layout';
import {
  perspectiveScaleAt,
  projectCellPolygon,
  projectWorldPoint,
  projectWorldRing,
  unprojectScreenPoint,
  visualScaleAt,
} from '../../src/game/render/projection';

describe('perspective projection', () => {
  const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 2 });

  function aspectAtRow(
    candidate: ReturnType<typeof computeCanvasLayout>,
    row: number,
  ): number {
    const left = projectWorldPoint(candidate, { x: 10, y: row });
    const right = projectWorldPoint(candidate, { x: 11, y: row });
    return (right.x - left.x) / candidate.projection.rowStep;
  }

  function expectPixelAlignedAspect(actual: number, expected: number): void {
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.012);
  }

  it('uses the approved far, near, and character scale values', () => {
    expect(perspectiveScaleAt(layout, 0)).toBeCloseTo(0.88);
    expect(perspectiveScaleAt(layout, GRID_HEIGHT)).toBeCloseTo(1.05);
    expect(visualScaleAt(layout, 0)).toBeCloseTo(1.1);
    expect(visualScaleAt(layout, GRID_HEIGHT)).toBeCloseTo(1.3125);
  });

  it.each([
    { viewport: { width: 844, height: 390, dpr: 1 } },
    { viewport: { width: 1280, height: 720, dpr: 1 } },
  ])('keeps projected tiles visually square in $viewport', ({ viewport }) => {
    const candidate = computeCanvasLayout(viewport);

    expectPixelAlignedAspect(aspectAtRow(candidate, 0), 0.88 / 0.965);
    expectPixelAlignedAspect(aspectAtRow(candidate, GRID_HEIGHT / 2), 1);
    expectPixelAlignedAspect(aspectAtRow(candidate, GRID_HEIGHT), 1.05 / 0.965);
  });

  it('keeps the entrance left of the snack chest', () => {
    const entrance = projectWorldPoint(layout, { x: 0.5, y: 2.5 });
    const chest = projectWorldPoint(layout, { x: 19.5, y: 3.5 });
    expect(entrance.x).toBeLessThan(chest.x);
  });

  it('makes near cells wider than far cells', () => {
    const far = projectCellPolygon(layout, { col: 10, row: 0 });
    const near = projectCellPolygon(layout, { col: 10, row: 9 });
    expect(near[1].x - far[0].x).toBeGreaterThan(0);
    expect(near[1].x - near[0].x).toBeGreaterThan(far[1].x - far[0].x);
  });

  it.each([
    { x: 0.5, y: 0.5 },
    { x: 5.25, y: 7.5 },
    { x: 12.5, y: 3.5 },
    { x: 19.5, y: 9.5 },
  ])('round-trips world point %o', (world) => {
    const screen = projectWorldPoint(layout, world);
    const restored = unprojectScreenPoint(layout, screen);
    expect(restored?.x).toBeCloseTo(world.x, 1);
    expect(restored?.y).toBeCloseTo(world.y, 1);
  });

  it('keeps every board corner inside the map bounds', () => {
    const points = [
      ...projectCellPolygon(layout, { col: 0, row: 0 }),
      ...projectCellPolygon(layout, { col: GRID_WIDTH - 1, row: 0 }),
      ...projectCellPolygon(layout, { col: 0, row: GRID_HEIGHT - 1 }),
      ...projectCellPolygon(layout, { col: GRID_WIDTH - 1, row: GRID_HEIGHT - 1 }),
    ];
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(layout.mapArea.x - 0.5);
      expect(point.x).toBeLessThanOrEqual(layout.mapArea.x + layout.mapArea.width + 0.5);
      expect(point.y).toBeGreaterThanOrEqual(layout.mapArea.y - 0.5);
      expect(point.y).toBeLessThanOrEqual(layout.mapArea.y + layout.mapArea.height + 0.5);
    }
  });

  it('rejects non-finite and outside inverse points', () => {
    expect(unprojectScreenPoint(layout, { x: Number.NaN, y: 10 })).toBeNull();
    expect(unprojectScreenPoint(layout, { x: 0, y: 0 })).toBeNull();
    expect(projectWorldRing(layout, { x: 2.5, y: 2.5 }, Number.MAX_VALUE)).toEqual([]);
  });
});
