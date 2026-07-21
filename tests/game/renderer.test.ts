import { describe, expect, it } from 'vitest';

import { createCanvasRenderer, type GameSnapshot } from '../../src/game/render/canvasRenderer';
import { drawEntities } from '../../src/game/render/drawEntities';
import { effectsForHits } from '../../src/game/render/effects';
import { computeCanvasLayout } from '../../src/game/render/layout';
import { worldToScreen } from '../../src/game/render/drawMap';
import {
  createRecordingContext,
  createTestAssets,
  createTestCanvas,
  imageTag,
} from './renderTestUtils';

function snapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    gold: 450,
    baseHp: 20,
    outcome: 'playing',
    enemies: [],
    towers: [],
    projectiles: [],
    hitEvents: [],
    wave: {
      index: 0,
      groupIndex: 0,
      spawnedInGroup: 0,
      spawnCooldown: 0,
      delayRemaining: 0,
      delayActive: false,
      allSpawned: false,
    },
    ...overrides,
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

describe('entity depth rendering', () => {
  it('globally sorts tower and enemy bodies by screen y before drawing HP bars', () => {
    const { context, calls } = createRecordingContext();
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    const state = snapshot({
      towers: [
        { id: 1, type: 'slow', cell: { col: 1, row: 1 }, position: { x: 1.5, y: 1.5 }, cooldownRemaining: 0 },
        { id: 2, type: 'huchu', cell: { col: 8, row: 6 }, position: { x: 8.5, y: 6.5 }, cooldownRemaining: 0 },
      ],
      enemies: [
        { id: 1, type: 'slime', hp: 20, maxHp: 42, progress: 0, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: 0 },
        { id: 2, type: 'orc', hp: 80, maxHp: 110, progress: 11, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: 0 },
      ],
    });

    drawEntities(context, layout, state, createTestAssets(), { timeSeconds: 0.5 });

    const bodyCalls = calls.filter((call) => (
      call.method === 'drawImage'
      && ['tower-slow', 'tower-huchu', 'enemy-slime', 'motion-orc'].includes(imageTag(call) ?? '')
    ));
    expect(bodyCalls.map(imageTag)).toEqual([
      'tower-slow',
      'enemy-slime',
      'motion-orc',
      'tower-huchu',
    ]);
    const firstHpBar = calls.findIndex((call) => (
      call.method === 'fillRect' && call.fillStyle === 'rgba(44, 38, 32, 0.78)'
    ));
    expect(firstHpBar).toBeGreaterThan(Math.max(...bodyCalls.map((call) => calls.indexOf(call))));
  });

  it.each([
    ['slow', 'tower-slow', 86 / 128],
    ['arrow', 'tower-arrow', 82 / 128],
    ['deokbae', 'tower-deokbae', 80 / 128],
    ['huchu', 'tower-huchu', 79 / 128],
  ] as const)('anchors the visible base of the %s tower to the front edge of its tile', (type, tag, groundAnchorY) => {
    const { context, calls } = createRecordingContext();
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    const state = snapshot({
      towers: [{
        id: 1,
        type,
        cell: { col: 1, row: 1 },
        position: { x: 1.5, y: 1.5 },
        cooldownRemaining: 0,
      }],
    });

    drawEntities(context, layout, state, createTestAssets());

    const translateCall = calls.find((call) => call.method === 'translate');
    const drawCall = calls.find((call) => imageTag(call) === tag);
    const spriteSize = layout.tileWidth * 2.6;
    const visibleBaseY = Number(translateCall?.args[1])
      + Number(drawCall?.args[6])
      + spriteSize * groundAnchorY;
    const tileCenter = worldToScreen(layout, { x: 1.5, y: 1.5 });
    expect(visibleBaseY).toBeCloseTo(tileCenter.y + layout.tileHeight / 2);
  });
});

describe('renderer layer order', () => {
  it('draws entity bodies and HP without a tower drop shadow, then foreground combat effects', () => {
    const { context, calls } = createRecordingContext();
    const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());
    const state = snapshot({
      towers: [
        { id: 1, type: 'slow', cell: { col: 1, row: 1 }, position: { x: 1.5, y: 1.5 }, cooldownRemaining: 0 },
      ],
      enemies: [
        { id: 1, type: 'slime', hp: 20, maxHp: 42, progress: 0, speedMultiplier: 0.62, rewarded: false, lastHitAtSeconds: 0 },
      ],
      projectiles: [
        { id: 1, towerType: 'huchu', position: { x: 2.5, y: 2.5 }, targetId: 1, damage: 72, speed: 5, splash: 1.25 },
      ],
      hitEvents: [
        { kind: 'hit', towerType: 'huchu', position: { x: 2.5, y: 2.5 }, radius: 1.25 },
      ],
    });

    renderer.render(state, {
      timeSeconds: 0.25,
      floatingGold: [{ position: { x: 2.5, y: 2.5 }, value: 5, ageSeconds: 0.1 }],
      effects: effectsForHits(state.hitEvents),
    });

    const towerDropShadow = calls.findIndex((call) => (
      call.method === 'ellipse' && call.fillStyle === 'rgba(124, 104, 224, 0.16)'
    ));
    const body = calls.findIndex((call) => imageTag(call) === 'tower-slow');
    const hp = calls.findIndex((call) => (
      call.method === 'fillRect' && call.fillStyle === 'rgba(44, 38, 32, 0.78)'
    ));
    const projectile = calls.findIndex((call) => imageTag(call) === 'vfx-waterball');
    const hit = calls.findIndex((call) => imageTag(call) === 'vfx-aqua-burst');
    const gold = calls.findIndex((call) => call.method === 'fillText' && call.args[0] === '+5');

    expect(towerDropShadow).toBe(-1);
    expect(body).toBeLessThan(hp);
    expect(hp).toBeLessThan(projectile);
    expect(projectile).toBeLessThan(hit);
    expect(hit).toBeLessThan(gold);
  });

  it('does not respawn snapshot hit events without an explicit retained effect list', () => {
    const { context, calls } = createRecordingContext();
    const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());
    const state = snapshot({
      hitEvents: [
        { kind: 'hit', towerType: 'huchu', position: { x: 2.5, y: 2.5 }, radius: 1.25 },
      ],
    });

    renderer.render(state);

    expect(calls.some((call) => imageTag(call) === 'vfx-aqua-burst')).toBe(false);
  });
});

describe('renderer boundaries', () => {
  it('shows regular HP for 2.5 seconds after a hit and keeps boss HP visible', () => {
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    const regular = snapshot({
      enemies: [{
        id: 1,
        type: 'slime',
        hp: 20,
        maxHp: 42,
        progress: 0,
        speedMultiplier: 1,
        rewarded: false,
        lastHitAtSeconds: 1,
      }],
    });
    const visibleRecording = createRecordingContext();
    drawEntities(
      visibleRecording.context,
      layout,
      regular,
      createTestAssets(),
      { timeSeconds: 3.5 },
    );
    expect(visibleRecording.calls.some((call) => (
      call.method === 'fillRect' && call.fillStyle === 'rgba(44, 38, 32, 0.78)'
    ))).toBe(true);

    const hiddenRecording = createRecordingContext();
    drawEntities(
      hiddenRecording.context,
      layout,
      regular,
      createTestAssets(),
      { timeSeconds: 3.51 },
    );
    expect(hiddenRecording.calls.some((call) => (
      call.method === 'fillRect' && call.fillStyle === 'rgba(44, 38, 32, 0.78)'
    ))).toBe(false);

    const bossRecording = createRecordingContext();
    drawEntities(
      bossRecording.context,
      layout,
      snapshot({
        enemies: [{
          id: 2,
          type: 'minotaur',
          hp: 900,
          maxHp: 1800,
          progress: 0,
          speedMultiplier: 1,
          rewarded: false,
          lastHitAtSeconds: null,
        }],
      }),
      createTestAssets(),
      { timeSeconds: 999 },
    );
    expect(bossRecording.calls.some((call) => (
      call.method === 'fillText' && call.args[0] === 'BOSS'
    ))).toBe(true);
    expect(bossRecording.calls.some((call) => (
      call.method === 'fillRect' && call.fillStyle === '#b96cff'
    ))).toBe(true);
  });

  it('renders a deep-frozen snapshot without mutation', () => {
    const { context } = createRecordingContext();
    const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());
    const state = deepFreeze(snapshot({
      towers: [
        { id: 1, type: 'arrow', cell: { col: 1, row: 1 }, position: { x: 1.5, y: 1.5 }, cooldownRemaining: 0 },
      ],
      enemies: [
        { id: 1, type: 'slime', hp: 20, maxHp: 42, progress: 0, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: null },
      ],
    }));
    const before = JSON.stringify(state);

    expect(() => renderer.render(state)).not.toThrow();
    expect(JSON.stringify(state)).toBe(before);
  });

  it('ignores invalid selection, range, entity and effect numbers at the Canvas boundary', () => {
    const { context, calls } = createRecordingContext({ rejectNonFinite: true });
    const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());
    const state = snapshot({
      towers: [
        { id: 1, type: 'huchu', cell: { col: 1, row: 1 }, position: { x: Number.POSITIVE_INFINITY, y: 1.5 }, cooldownRemaining: 0 },
      ],
      enemies: [
        { id: 1, type: 'slime', hp: Number.NaN, maxHp: 0, progress: 0, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: 0 },
      ],
      projectiles: [
        { id: 1, towerType: 'huchu', position: { x: Number.NaN, y: 2.5 }, targetId: 1, damage: 72, speed: 5, splash: 1.25 },
      ],
      hitEvents: [
        { kind: 'hit', towerType: 'huchu', position: { x: 2.5, y: Number.NEGATIVE_INFINITY }, radius: Number.POSITIVE_INFINITY },
      ],
    });

    expect(() => renderer.render(state, {
      selectedCell: { col: 1.5, row: 2 },
      selectedRange: Number.POSITIVE_INFINITY,
      timeSeconds: Number.NaN,
      floatingGold: [{
        position: { x: Number.POSITIVE_INFINITY, y: 2.5 },
        value: Number.NaN,
        ageSeconds: Number.NEGATIVE_INFINITY,
      }],
    })).not.toThrow();
    expect(calls.some((call) => call.fillStyle === 'rgba(50, 218, 220, 0.38)')).toBe(false);
    const hpFill = calls.find((call) => call.method === 'fillRect' && call.fillStyle === '#ef665d');
    expect(hpFill?.args[2]).toBe(0);
  });

  it('ignores finite inputs when derived Canvas coordinates would overflow', () => {
    const { context } = createRecordingContext({ rejectNonFinite: true });
    const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());
    const state = snapshot({
      towers: [
        { id: 1, type: 'huchu', cell: { col: 1, row: 1 }, position: { x: Number.MAX_VALUE, y: 1.5 }, cooldownRemaining: 0 },
      ],
      projectiles: [
        { id: 1, towerType: 'huchu', position: { x: Number.MAX_VALUE, y: 2.5 }, targetId: 1, damage: 72, speed: 5, splash: 1.25 },
      ],
      hitEvents: [
        { kind: 'hit', towerType: 'huchu', position: { x: 2.5, y: 2.5 }, radius: Number.MAX_VALUE },
      ],
    });

    expect(() => renderer.render(state, {
      selectedCell: { col: 1, row: 1 },
      selectedRange: Number.MAX_VALUE,
      floatingGold: [{
        position: { x: 2.5, y: 2.5 },
        value: 1,
        ageSeconds: Number.MAX_VALUE,
      }],
    })).not.toThrow();
  });

  it('clamps finite HP ratios to zero and one when max HP is positive', () => {
    const { context, calls } = createRecordingContext({ rejectNonFinite: true });
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    const state = snapshot({
      enemies: [
        { id: 1, type: 'slime', hp: -10, maxHp: 100, progress: 0, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: 0 },
        { id: 2, type: 'slime', hp: 200, maxHp: 100, progress: 0.1, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: 0 },
      ],
    });

    drawEntities(context, layout, state, createTestAssets(), { timeSeconds: 1 });

    const emptyHp = calls.find((call) => call.method === 'fillRect' && call.fillStyle === '#ef665d');
    const fullHp = calls.find((call) => call.method === 'fillRect' && call.fillStyle === '#7bd45d');
    const barBackground = calls.find((call) => (
      call.method === 'fillRect' && call.fillStyle === 'rgba(44, 38, 32, 0.78)'
    ));
    expect(emptyHp?.args[2]).toBe(0);
    expect(fullHp?.args[2]).toBe(barBackground?.args[2]);
  });

  it('caps renderer resize DPR and aligns cell centers to physical pixels', () => {
    const { context } = createRecordingContext();
    const canvas = createTestCanvas(context);
    const renderer = createCanvasRenderer(canvas, createTestAssets());

    const layout = renderer.resize({ width: 844, height: 390, dpr: 3 });
    const center = worldToScreen(layout, { x: 0.5, y: 0.5 });

    expect(layout.dpr).toBe(2);
    expect(canvas.width).toBe(1688);
    expect(canvas.height).toBe(780);
    expect(center.x * layout.dpr).toBe(Math.round(center.x * layout.dpr));
    expect(center.y * layout.dpr).toBe(Math.round(center.y * layout.dpr));
  });
});
