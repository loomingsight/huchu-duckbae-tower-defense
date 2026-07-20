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
        { id: 1, type: 'slime', hp: 20, maxHp: 42, progress: 0, speedMultiplier: 1, rewarded: false },
        { id: 2, type: 'orc', hp: 80, maxHp: 110, progress: 11, speedMultiplier: 1, rewarded: false },
      ],
    });

    drawEntities(context, layout, state, createTestAssets());

    const bodyCalls = calls.filter((call) => call.method === 'drawImage');
    expect(bodyCalls.map(imageTag)).toEqual([
      'tower-slow',
      'enemy-slime',
      'tower-huchu',
      'enemy-orc',
    ]);
    const firstHpBar = calls.findIndex((call) => (
      call.method === 'fillRect' && call.fillStyle === 'rgba(44, 38, 32, 0.72)'
    ));
    expect(firstHpBar).toBeGreaterThan(Math.max(...bodyCalls.map((call) => calls.indexOf(call))));
  });
});

describe('renderer layer order', () => {
  it('draws slow ground aura, entity bodies and HP, then foreground combat effects', () => {
    const { context, calls } = createRecordingContext();
    const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());
    const state = snapshot({
      towers: [
        { id: 1, type: 'slow', cell: { col: 1, row: 1 }, position: { x: 1.5, y: 1.5 }, cooldownRemaining: 0 },
      ],
      enemies: [
        { id: 1, type: 'slime', hp: 20, maxHp: 42, progress: 0, speedMultiplier: 0.62, rewarded: false },
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

    const slowAura = calls.findIndex((call) => (
      call.method === 'arc' && call.fillStyle === 'rgba(116, 102, 215, 0.075)'
    ));
    const body = calls.findIndex((call) => call.method === 'drawImage');
    const hp = calls.findIndex((call) => (
      call.method === 'fillRect' && call.fillStyle === 'rgba(44, 38, 32, 0.72)'
    ));
    const projectile = calls.findIndex((call) => (
      call.method === 'arc' && call.fillStyle === '#1ca5c4'
    ));
    const hit = calls.findIndex((call) => (
      call.method === 'arc' && call.fillStyle === 'rgba(73, 211, 235, 0.2)'
    ));
    const gold = calls.findIndex((call) => call.method === 'fillText' && call.args[0] === '+5');

    expect(slowAura).toBeGreaterThanOrEqual(0);
    expect(slowAura).toBeLessThan(body);
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

    expect(calls.some((call) => (
      call.method === 'arc' && call.fillStyle === 'rgba(73, 211, 235, 0.2)'
    ))).toBe(false);
  });
});

describe('renderer boundaries', () => {
  it('renders a deep-frozen snapshot without mutation', () => {
    const { context } = createRecordingContext();
    const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());
    const state = deepFreeze(snapshot({
      towers: [
        { id: 1, type: 'arrow', cell: { col: 1, row: 1 }, position: { x: 1.5, y: 1.5 }, cooldownRemaining: 0 },
      ],
      enemies: [
        { id: 1, type: 'slime', hp: 20, maxHp: 42, progress: 0, speedMultiplier: 1, rewarded: false },
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
        { id: 1, type: 'slime', hp: Number.NaN, maxHp: 0, progress: 0, speedMultiplier: 1, rewarded: false },
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
    expect(calls.some((call) => call.fillStyle === 'rgba(70, 209, 230, 0.34)')).toBe(false);
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
        { id: 1, type: 'slime', hp: -10, maxHp: 100, progress: 0, speedMultiplier: 1, rewarded: false },
        { id: 2, type: 'slime', hp: 200, maxHp: 100, progress: 0.1, speedMultiplier: 1, rewarded: false },
      ],
    });

    drawEntities(context, layout, state, createTestAssets());

    const emptyHp = calls.find((call) => call.method === 'fillRect' && call.fillStyle === '#ef665d');
    const fullHp = calls.find((call) => call.method === 'fillRect' && call.fillStyle === '#7bd45d');
    const barBackground = calls.find((call) => (
      call.method === 'fillRect' && call.fillStyle === 'rgba(44, 38, 32, 0.72)'
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
