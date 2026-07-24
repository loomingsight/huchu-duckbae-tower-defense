import { describe, expect, it } from 'vitest';

import {
  ATMOSPHERE_PROFILES,
  drawMap,
  drawStageAtmosphere,
  NORMAL_PALETTES,
} from '../../src/game/render/drawMap';
import { computeCanvasLayout } from '../../src/game/render/layout';
import { getStageDefinition } from '../../src/game/stages/stageCatalog';
import {
  NIGHTMARE_THEME_IDS,
  NORMAL_THEME_IDS,
  type StageThemeId,
} from '../../src/game/stages/stageIdentity';
import { createRecordingContext, createTestAssets, imageTag } from './renderTestUtils';

function atmosphereElementCount(
  calls: ReturnType<typeof createRecordingContext>['calls'],
  themeId: StageThemeId,
): number {
  const colors = new Set(ATMOSPHERE_PROFILES[themeId].colors);
  return calls.filter((call) => (
    (call.method === 'fill' && typeof call.fillStyle === 'string' && colors.has(call.fillStyle))
    || (call.method === 'stroke'
      && typeof call.strokeStyle === 'string'
      && colors.has(call.strokeStyle))
  )).length;
}

function stableCalls(calls: ReturnType<typeof createRecordingContext>['calls']) {
  return calls.map(({ method, args, fillStyle, strokeStyle }) => ({
    method,
    args,
    fillStyle: typeof fillStyle === 'string' ? fillStyle : '[gradient]',
    strokeStyle: typeof strokeStyle === 'string' ? strokeStyle : '[gradient]',
  }));
}

describe('perspective map rendering', () => {
  it('draws green build tiles, plain sand roads, a board side, and only landmark sprites', () => {
    const { context, calls } = createRecordingContext();
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    drawMap(context, layout, createTestAssets(), getStageDefinition(1));

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
    drawMap(context, layout, createTestAssets(), getStageDefinition(1), {
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
    drawMap(context, layout, createTestAssets(), getStageDefinition(1), {
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

    drawMap(context, layout, createTestAssets(), stage);

    expect(calls.filter((call) => (
      call.method === 'fill' && call.fillStyle === NORMAL_PALETTES.minotaurGate.road
    ))).toHaveLength(stage.map.pathCells.length);
  });

  it('uses distinct normal palettes and preserves dark nightmare colors', () => {
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    const normalColors = new Set<string>();
    for (const themeId of NORMAL_THEME_IDS) {
      const palette = NORMAL_PALETTES[themeId];
      normalColors.add(palette.land);
      const rendered = createRecordingContext();
      drawMap(
        rendered.context,
        layout,
        createTestAssets(),
        getStageDefinition(`normal-${NORMAL_THEME_IDS.indexOf(themeId) + 1}`),
      );
      expect(rendered.calls.some(({ fillStyle }) => fillStyle === palette.land)).toBe(true);
      expect(ATMOSPHERE_PROFILES[themeId]).toBeDefined();
    }
    const nightmare = createRecordingContext();
    drawMap(
      nightmare.context,
      layout,
      createTestAssets(),
      getStageDefinition('nightmare-1'),
    );

    expect(normalColors.size).toBe(6);
    expect(nightmare.calls.some(({ fillStyle }) => fillStyle === '#18243a')).toBe(true);
    expect(nightmare.calls.some(({ fillStyle }) => fillStyle === '#485064')).toBe(true);
    for (const themeId of NIGHTMARE_THEME_IDS) {
      expect(ATMOSPHERE_PROFILES[themeId]).toBeDefined();
    }
  });

  it('limits every deterministic atmosphere profile to twelve or six elements', () => {
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    for (const themeId of [...NORMAL_THEME_IDS, ...NIGHTMARE_THEME_IDS]) {
      const full = createRecordingContext();
      const reduced = createRecordingContext();
      drawStageAtmosphere(full.context, layout, themeId, 2.5, false);
      drawStageAtmosphere(reduced.context, layout, themeId, 2.5, true);

      expect(atmosphereElementCount(full.calls, themeId)).toBeLessThanOrEqual(12);
      expect(atmosphereElementCount(full.calls, themeId)).toBeGreaterThan(0);
      expect(atmosphereElementCount(reduced.calls, themeId)).toBeLessThanOrEqual(6);
      expect(atmosphereElementCount(reduced.calls, themeId)).toBeGreaterThan(0);
    }
  });

  it('draws identical atmosphere for identical inputs and normalizes invalid time', () => {
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    const first = createRecordingContext();
    const second = createRecordingContext();
    const zero = createRecordingContext();
    const invalid = createRecordingContext();

    drawStageAtmosphere(first.context, layout, 'windyHill', 7.25);
    drawStageAtmosphere(second.context, layout, 'windyHill', 7.25);
    drawStageAtmosphere(zero.context, layout, 'orcCanyon', 0);
    drawStageAtmosphere(invalid.context, layout, 'orcCanyon', Number.NaN);

    expect(stableCalls(first.calls)).toEqual(stableCalls(second.calls));
    expect(stableCalls(invalid.calls)).toEqual(stableCalls(zero.calls));
  });

  it('keeps atmosphere below placement and range overlays', () => {
    const { context, calls } = createRecordingContext();
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });

    drawMap(context, layout, createTestAssets(), getStageDefinition('normal-1'), {
      buildableCells: [{ col: 1, row: 1 }],
      cell: { col: 2, row: 1 },
      range: 2,
    }, 1.5);

    const atmosphereIndex = calls.findIndex((call) => (
      call.method === 'fill' && call.fillStyle === ATMOSPHERE_PROFILES.sunnyField.colors[0]
    ));
    const guideIndex = calls.findIndex((call) => (
      call.method === 'fill' && call.fillStyle === 'rgba(54, 145, 255, 0.28)'
    ));
    const rangeIndex = calls.findIndex((call) => (
      call.method === 'fill' && call.fillStyle === 'rgba(76, 214, 222, 0.13)'
    ));

    expect(atmosphereIndex).toBeGreaterThan(-1);
    expect(guideIndex).toBeGreaterThan(atmosphereIndex);
    expect(rangeIndex).toBeGreaterThan(guideIndex);
  });
});
