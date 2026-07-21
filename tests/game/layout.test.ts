import { describe, expect, it } from 'vitest';

import { computeCanvasLayout } from '../../src/game/render/layout';

describe('computeCanvasLayout', () => {
  it('uses the full portrait viewport and requests landscape orientation', () => {
    const layout = computeCanvasLayout({ width: 390, height: 844, dpr: 1 });

    expect(layout.showOrientationPrompt).toBe(true);
    expect(layout.gameArea).toEqual({ x: 0, y: 0, width: 390, height: 844 });
    expect(layout.gameArea.x + layout.gameArea.width / 2).toBeCloseTo(390 / 2);
    expect(layout.gameArea.y + layout.gameArea.height / 2).toBeCloseTo(844 / 2);
  });

  it('maximizes the full perspective board inside an 844 by 390 landscape viewport', () => {
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });

    expect(layout.showOrientationPrompt).toBe(false);
    expect(layout.gameArea).toEqual({ x: 0, y: 0, width: 844, height: 390 });
    expect(layout.mapArea.width).toBeLessThanOrEqual(844 * 0.99);
    expect(layout.mapArea.width).toBeGreaterThan(844 * 0.98);
    expect(layout.mapArea.height).toBeCloseTo(390 * 0.98);
    expect(layout.projection.centerX).toBeCloseTo(422);
    expect(layout.projection.topY).toBeCloseTo(layout.mapArea.y);
    expect(layout.projection.farScale).toBe(0.88);
    expect(layout.projection.nearScale).toBe(1.05);
    expect(layout.projection.rowStep)
      .toBeCloseTo(layout.projection.baseCellWidth * 0.965);
    expect(layout.tileWidth).toBeCloseTo(layout.projection.baseCellWidth);
    expect(layout.tileHeight).toBeCloseTo(layout.projection.rowStep);
    expect(layout.mapArea.x).toBeGreaterThanOrEqual(layout.gameArea.x);
    expect(layout.mapArea.y).toBeGreaterThanOrEqual(layout.gameArea.y);
    expect(layout.mapArea.x + layout.mapArea.width).toBeLessThanOrEqual(844);
    expect(layout.mapArea.y + layout.mapArea.height).toBeLessThanOrEqual(390);
  });

  it('caps device pixel ratio at two', () => {
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 3 });

    expect(layout.dpr).toBe(2);
    expect(layout.backingWidth).toBe(1688);
    expect(layout.backingHeight).toBe(780);
  });
});
