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

  it('centers a landscape game area and keeps the full 20 by 10 map visible', () => {
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });

    expect(layout.showOrientationPrompt).toBe(false);
    expect(layout.gameArea).toEqual({ x: 0, y: 0, width: 844, height: 390 });
    expect(layout.gameArea.x + layout.gameArea.width / 2).toBeCloseTo(844 / 2);
    expect(layout.gameArea.y + layout.gameArea.height / 2).toBeCloseTo(390 / 2);
    expect(layout.mapArea.width).toBeCloseTo(layout.tileWidth * 15);
    expect(layout.mapArea.height).toBeCloseTo(layout.tileHeight * 15);
    expect(layout.tileHeight).toBeCloseTo(layout.tileWidth * 0.44);
    expect(layout.mapOrigin.x).toBeCloseTo(layout.mapArea.x + layout.tileWidth * 5);
    expect(layout.mapOrigin.y).toBeCloseTo(layout.mapArea.y);
    expect(layout.mapArea.x).toBeGreaterThanOrEqual(layout.gameArea.x);
    expect(layout.mapArea.y).toBeGreaterThanOrEqual(layout.gameArea.y);
    expect(layout.mapArea.x + layout.mapArea.width).toBeLessThanOrEqual(
      layout.gameArea.x + layout.gameArea.width,
    );
    expect(layout.mapArea.y + layout.mapArea.height).toBeLessThanOrEqual(
      layout.gameArea.y + layout.gameArea.height,
    );
  });

  it('caps device pixel ratio at two', () => {
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 3 });

    expect(layout.dpr).toBe(2);
    expect(layout.backingWidth).toBe(1688);
    expect(layout.backingHeight).toBe(780);
  });
});
