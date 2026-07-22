import { describe, expect, it } from 'vitest';

import { drawMap } from '../../src/game/render/drawMap';
import { computeCanvasLayout } from '../../src/game/render/layout';
import { getStageDefinition } from '../../src/game/stages/stageCatalog';
import { createRecordingContext, createTestAssets, imageTag } from './renderTestUtils';

describe('perspective map rendering', () => {
  it('draws green build tiles, plain sand roads, a board side, and only landmark sprites', () => {
    const { context, calls } = createRecordingContext();
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    drawMap(context, layout, createTestAssets(), getStageDefinition(1).map);

    expect(calls.some((call) => call.method === 'fill' && call.fillStyle === '#4f8c65')).toBe(true);
    expect(calls.some((call) => call.method === 'fill' && call.fillStyle === '#5d9a70')).toBe(true);
    expect(calls.some((call) => call.method === 'fill' && call.fillStyle === '#e4c99f')).toBe(true);
    expect(calls.some((call) => call.method === 'fill' && call.fillStyle === '#2f6247')).toBe(true);
    const tags = calls.filter((call) => call.method === 'drawImage').map(imageTag);
    expect(tags).not.toContain('map-entry');
    expect(tags).toContain('map-snack-chest');
    expect(tags).not.toContain('map-grass');
    expect(tags.some((tag) => tag?.startsWith('map-road-') === true)).toBe(false);
  });

  it('renders selection and range as projected polygons instead of an isometric ellipse', () => {
    const { context, calls } = createRecordingContext();
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    drawMap(context, layout, createTestAssets(), getStageDefinition(1).map, {
      cell: { col: 2, row: 1 },
      range: 3.2,
      valid: true,
    });

    expect(calls.some((call) => (
      call.method === 'fill' && call.fillStyle === 'rgba(76, 214, 222, 0.13)'
    ))).toBe(true);
    expect(calls.some((call) => (
      call.method === 'stroke' && call.strokeStyle === 'rgba(94, 228, 232, 0.62)'
    ))).toBe(true);
    expect(calls.some((call) => call.method === 'ellipse')).toBe(false);
  });

  it('renders every available placement cell with a blue projected guide', () => {
    const { context, calls } = createRecordingContext();
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    drawMap(context, layout, createTestAssets(), getStageDefinition(1).map, {
      buildableCells: [{ col: 1, row: 1 }, { col: 2, row: 1 }],
    });

    expect(calls.filter((call) => (
      call.method === 'fill' && call.fillStyle === 'rgba(54, 145, 255, 0.28)'
    ))).toHaveLength(2);
  });

  it('draws the exact road cells from the selected stage map', () => {
    const { context, calls } = createRecordingContext();
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    const stage = getStageDefinition(6);

    drawMap(context, layout, createTestAssets(), stage.map);

    expect(calls.filter((call) => (
      call.method === 'fill' && call.fillStyle === '#e4c99f'
    ))).toHaveLength(stage.map.pathCells.length);
  });
});
