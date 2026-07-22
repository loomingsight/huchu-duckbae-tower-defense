import { describe, expect, it } from 'vitest';

import { enemyPosition } from '../../src/game/combat/targeting';
import { cellCenter } from '../../src/game/core/geometry';
import { createCanvasRenderer, type GameSnapshot } from '../../src/game/render/canvasRenderer';
import { drawEntities, towerSizeFactor } from '../../src/game/render/drawEntities';
import { slowPulseRadius } from '../../src/game/render/drawEffects';
import { effectsForHits, slowPulseEffects } from '../../src/game/render/effects';
import { computeCanvasLayout } from '../../src/game/render/layout';
import { projectWorldPoint, visualScaleAt } from '../../src/game/render/projection';
import { getStageDefinition } from '../../src/game/stages/stageCatalog';
import { TOWER_CATALOG } from '../../src/game/towers/towerCatalog';
import {
  createRecordingContext,
  createTestAssets,
  createTestCanvas,
  imageTag,
} from './renderTestUtils';

function snapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    stageId: 1,
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
  it('renders the slow tower ten percent smaller without changing other tower scales', () => {
    expect(towerSizeFactor('slow')).toBe(1.8);
    expect(towerSizeFactor('arrow')).toBe(2);
    expect(towerSizeFactor('deokbae')).toBe(2);
    expect(towerSizeFactor('huchu')).toBe(2);
  });

  it('positions enemies on the selected stage path', () => {
    const { context, calls } = createRecordingContext();
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    const stage = getStageDefinition(6);
    const progress = stage.map.pathCells.length - 1;
    const state = snapshot({
      stageId: 6,
      enemies: [{
        id: 0,
        type: 'slime',
        hp: 42,
        maxHp: 42,
        progress,
        speedMultiplier: 1,
        rewarded: false,
        lastHitAtSeconds: null,
      }],
    });

    drawEntities(context, layout, state, createTestAssets(), { timeSeconds: 0 });

    const translate = calls.find((call) => call.method === 'translate');
    const expected = projectWorldPoint(layout, cellCenter(stage.map.pathCells.at(-1)!));
    expect(translate?.args).toEqual([expected.x, expected.y]);
  });

  it('globally sorts tower and enemy bodies by screen y before drawing HP bars', () => {
    const { context, calls } = createRecordingContext();
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    const state = snapshot({
      towers: [
        { id: 1, type: 'slow', cell: { col: 1, row: 1 }, position: { x: 1.5, y: 1.5 }, cooldownRemaining: 0, placedAtSeconds: 0 },
        { id: 2, type: 'huchu', cell: { col: 8, row: 6 }, position: { x: 8.5, y: 6.5 }, cooldownRemaining: 0, placedAtSeconds: 0 },
      ],
      enemies: [
        { id: 1, type: 'slime', hp: 20, maxHp: 42, progress: 0, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: 0 },
        { id: 2, type: 'orc', hp: 80, maxHp: 110, progress: 11, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: 0 },
      ],
    });

    drawEntities(context, layout, state, createTestAssets(), { timeSeconds: 0.5 });

    const bodyCalls = calls.filter((call) => (
      call.method === 'drawImage'
      && ['tower-slow', 'tower-huchu', 'enemy-slime-se', 'motion-orc'].includes(imageTag(call) ?? '')
    ));
    expect(bodyCalls.map(imageTag)).toEqual([
      'tower-slow',
      'enemy-slime-se',
      'tower-huchu',
      'motion-orc',
    ]);
    const firstHpBar = calls.findIndex((call) => (
      call.method === 'fillRect' && call.fillStyle === 'rgba(44, 38, 32, 0.78)'
    ));
    expect(firstHpBar).toBeGreaterThan(Math.max(...bodyCalls.map((call) => calls.indexOf(call))));
  });

  it.each([
    ['slow', 'tower-slow', 86 / 128],
    ['arrow', 'tower-arrow-se', 82 / 128],
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
        placedAtSeconds: 0,
      }],
    });

    drawEntities(context, layout, state, createTestAssets());

    const translateCall = calls.find((call) => call.method === 'translate');
    const drawCall = calls.find((call) => imageTag(call) === tag);
    const scale = visualScaleAt(layout, 1.5);
    const spriteSize = layout.tileWidth * towerSizeFactor(type) * scale;
    const visibleBaseY = Number(translateCall?.args[1])
      + Number(drawCall?.args[6])
      + spriteSize * groundAnchorY;
    const tileFront = projectWorldPoint(layout, { x: 1.5, y: 2 });
    expect(visibleBaseY).toBeCloseTo(tileFront.y);
  });

  it('keeps static enemies front-facing and always uses front motion sheets', () => {
    const { context, calls } = createRecordingContext();
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    const state = snapshot({
      enemies: [
        { id: 1, type: 'slime', hp: 42, maxHp: 42, progress: 0, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: null },
        { id: 2, type: 'golem', hp: 320, maxHp: 320, progress: 6, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: null },
        { id: 3, type: 'orc', hp: 110, maxHp: 110, progress: 11, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: null },
        { id: 4, type: 'fairy', hp: 32, maxHp: 32, progress: 16, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: null },
      ],
    });

    drawEntities(context, layout, state, createTestAssets(), { timeSeconds: 0.5 });
    const tags = calls.filter((call) => call.method === 'drawImage').map(imageTag);
    expect(tags).toContain('enemy-slime-se');
    expect(tags).toContain('enemy-golem-se');
    expect(tags).toContain('motion-orc');
    expect(tags).toContain('motion-fairy');
    expect(tags.some((tag) => (
      tag === 'enemy-slime-ne' || tag === 'enemy-slime-sw' || tag === 'enemy-slime-nw'
    ))).toBe(false);
  });

  it('renders a near tower larger than the same tower on a far row', () => {
    const { context, calls } = createRecordingContext();
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    drawEntities(context, layout, snapshot({
      towers: [
        { id: 1, type: 'slow', cell: { col: 1, row: 0 }, position: { x: 1.5, y: 0.5 }, cooldownRemaining: 0, placedAtSeconds: 0 },
        { id: 2, type: 'slow', cell: { col: 1, row: 8 }, position: { x: 1.5, y: 8.5 }, cooldownRemaining: 0, placedAtSeconds: 0 },
      ],
    }), createTestAssets());
    const widths = calls
      .filter((call) => imageTag(call) === 'tower-slow')
      .map((call) => Number(call.args[7]));
    expect(widths).toHaveLength(2);
    expect(widths[1]).toBeGreaterThan(widths[0]);
  });

  it('keeps walk frames at full speed while enemy bobbing runs at half speed', () => {
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    const enemy = {
      id: 0,
      type: 'orc' as const,
      hp: 110,
      maxHp: 110,
      progress: 0,
      speedMultiplier: 1,
      rewarded: false,
      lastHitAtSeconds: null,
    };
    const position = enemyPosition(enemy);
    expect(position).toBeDefined();

    const originRecording = createRecordingContext();
    drawEntities(originRecording.context, layout, snapshot({ enemies: [enemy] }), createTestAssets(), {
      timeSeconds: 0,
    });
    const originY = Number(originRecording.calls.find((call) => call.method === 'translate')?.args[1]);

    const bobTime = 1 / 32;
    const bobRecording = createRecordingContext();
    drawEntities(bobRecording.context, layout, snapshot({ enemies: [enemy] }), createTestAssets(), {
      timeSeconds: bobTime,
    });
    const bobY = Number(bobRecording.calls.find((call) => call.method === 'translate')?.args[1]);
    const expectedBounce = Math.sin((bobTime * 8 * 0.5) * Math.PI * 2)
      * layout.tileHeight
      * visualScaleAt(layout, position?.y ?? 0)
      * 0.09;
    expect(bobY).toBeCloseTo(originY - expectedBounce);

    const frameRecording = createRecordingContext();
    drawEntities(frameRecording.context, layout, snapshot({ enemies: [enemy] }), createTestAssets(), {
      timeSeconds: 1 / 8,
    });
    const frameDraw = frameRecording.calls.find((call) => (
      call.method === 'drawImage' && imageTag(call) === 'motion-orc'
    ));
    expect(frameDraw?.args[1]).toBe(256);
  });

  it('grounds only the orc lower while preserving the default enemy anchor', () => {
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    const { context, calls } = createRecordingContext();
    drawEntities(context, layout, snapshot({
      enemies: [
        { id: 1, type: 'slime', hp: 42, maxHp: 42, progress: 0, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: null },
        { id: 2, type: 'orc', hp: 110, maxHp: 110, progress: 11, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: null },
      ],
    }), createTestAssets(), { timeSeconds: 0 });

    const slimeDraw = calls.find((call) => call.method === 'drawImage' && imageTag(call) === 'enemy-slime-se');
    const orcDraw = calls.find((call) => call.method === 'drawImage' && imageTag(call) === 'motion-orc');
    expect(slimeDraw?.args[6]).toBeCloseTo(-Number(slimeDraw?.args[8]) * 0.76);
    expect(orcDraw?.args[6]).toBeCloseTo(-Number(orcDraw?.args[8]) * 0.60);
  });
});

describe('renderer layer order', () => {
  it('expands a slow pulse from its center to the configured tower range', () => {
    expect(slowPulseRadius(0)).toBe(0.35);
    expect(slowPulseRadius(1)).toBe(TOWER_CATALOG.slow.range);
    expect(slowPulseRadius(-1)).toBe(0.35);
    expect(slowPulseRadius(2)).toBe(TOWER_CATALOG.slow.range);
  });

  it('renders the active stage map instead of the stage-one map', () => {
    const { context, calls } = createRecordingContext();
    const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());
    const stage = getStageDefinition(6);

    renderer.render(snapshot({ stageId: 6 }));

    expect(calls.filter((call) => (
      call.method === 'fill' && call.fillStyle === '#e4c99f'
    ))).toHaveLength(stage.map.pathCells.length);
  });

  it('aims arrow towers and projectiles along the selected stage path', () => {
    const { context, calls } = createRecordingContext();
    const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());
    const stage = getStageDefinition(6);
    const targetId = 1;

    renderer.render(snapshot({
      stageId: 6,
      towers: [{
        id: 1,
        type: 'arrow',
        cell: { col: 18, row: 2 },
        position: { x: 18.5, y: 2.5 },
        cooldownRemaining: 0,
        placedAtSeconds: 0,
      }],
      enemies: [{
        id: targetId,
        type: 'slime',
        hp: 42,
        maxHp: 42,
        progress: stage.map.pathCells.length - 1,
        speedMultiplier: 1,
        rewarded: false,
        lastHitAtSeconds: null,
      }],
      projectiles: [{
        id: 1,
        towerType: 'arrow',
        position: { x: 18.5, y: 2.5 },
        targetId,
        damage: 18,
        speed: 8,
        splash: 0,
      }],
    }), { timeSeconds: 0 });

    expect(calls.some((call) => imageTag(call) === 'tower-arrow-se')).toBe(true);
    const arrow = calls.find((call) => imageTag(call) === 'vfx-arrow');
    expect(arrow?.args[1]).toBe(0);
  });

  it('draws a scheduled slow pulse below the owning tower', () => {
    const { context, calls } = createRecordingContext();
    const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());
    const state = snapshot({
      towers: [{
        id: 1,
        type: 'slow',
        cell: { col: 1, row: 1 },
        position: { x: 1.5, y: 1.5 },
        cooldownRemaining: 0,
        placedAtSeconds: 0,
      }],
    });

    renderer.render(state, {
      timeSeconds: 3.25,
      effects: slowPulseEffects(state.towers, 3.25),
    });

    const pulse = calls.findIndex((call) => (
      call.method === 'stroke'
      && String(call.strokeStyle).startsWith('rgba(170, 132, 255,')
    ));
    const towerBody = calls.findIndex((call) => imageTag(call) === 'tower-slow');
    expect(pulse).toBeGreaterThan(-1);
    expect(pulse).toBeLessThan(towerBody);
  });

  it('forwards placement guide cells to the map layer', () => {
    const { context, calls } = createRecordingContext();
    const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());

    renderer.render(snapshot(), {
      placementGuideCells: [{ col: 1, row: 1 }, { col: 2, row: 1 }],
    });

    expect(calls.filter((call) => (
      call.method === 'fill' && call.fillStyle === 'rgba(54, 145, 255, 0.28)'
    ))).toHaveLength(2);
  });

  it('renders near projectiles larger than far projectiles', () => {
    const { context, calls } = createRecordingContext();
    const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());
    renderer.render(snapshot({
      projectiles: [
        { id: 1, towerType: 'huchu', position: { x: 2.5, y: 0.5 }, targetId: 1, damage: 72, speed: 5, splash: 1.25 },
        { id: 2, towerType: 'huchu', position: { x: 2.5, y: 8.5 }, targetId: 1, damage: 72, speed: 5, splash: 1.25 },
      ],
    }), { timeSeconds: 0.25 });
    const widths = calls
      .filter((call) => imageTag(call) === 'vfx-waterball')
      .map((call) => Number(call.args[7]));
    expect(widths).toHaveLength(2);
    expect(widths[1]).toBeGreaterThan(widths[0]);
  });

  it.each([
    ['deokbae', 'vfx-fireball', 2.325],
    ['huchu', 'vfx-waterball', 3.4],
  ] as const)('renders %s projectile at the approved elemental scale', (towerType, tag, factor) => {
    const { context, calls } = createRecordingContext();
    const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());
    const position = { x: 2.5, y: 2.5 };

    renderer.render(snapshot({
      projectiles: [{
        id: 1,
        towerType,
        position,
        targetId: 1,
        damage: 20,
        speed: 5,
        splash: 1,
      }],
    }), { timeSeconds: 0.25 });

    const draw = calls.find((call) => call.method === 'drawImage' && imageTag(call) === tag);
    const expectedSize = renderer.getLayout().tileWidth
      * visualScaleAt(renderer.getLayout(), position.y)
      * factor;
    expect(draw?.args[7]).toBeCloseTo(expectedSize);
    expect(draw?.args[8]).toBeCloseTo(expectedSize);
  });

  it('crops entity, motion, and projectile sprites from 256px source frames', () => {
    const { context, calls } = createRecordingContext();
    const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());
    renderer.render(snapshot({
      towers: [
        { id: 1, type: 'slow', cell: { col: 1, row: 1 }, position: { x: 1.5, y: 1.5 }, cooldownRemaining: 0, placedAtSeconds: 0 },
      ],
      enemies: [
        { id: 1, type: 'slime', hp: 42, maxHp: 42, progress: 0, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: null },
        { id: 2, type: 'orc', hp: 110, maxHp: 110, progress: 11, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: null },
      ],
      projectiles: [
        { id: 1, towerType: 'huchu', position: { x: 2.5, y: 2.5 }, targetId: 1, damage: 72, speed: 5, splash: 1.25 },
      ],
    }), { timeSeconds: 0.25 });

    for (const tag of ['tower-slow', 'enemy-slime-se', 'motion-orc', 'vfx-waterball']) {
      const draw = calls.find((call) => call.method === 'drawImage' && imageTag(call) === tag);
      expect(draw?.args[3]).toBe(256);
      expect(draw?.args[4]).toBe(256);
    }
  });

  it('draws entity bodies and HP without a tower drop shadow, then foreground combat effects', () => {
    const { context, calls } = createRecordingContext();
    const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());
    const state = snapshot({
      towers: [
        { id: 1, type: 'slow', cell: { col: 1, row: 1 }, position: { x: 1.5, y: 1.5 }, cooldownRemaining: 0, placedAtSeconds: 0 },
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
        { id: 1, type: 'arrow', cell: { col: 1, row: 1 }, position: { x: 1.5, y: 1.5 }, cooldownRemaining: 0, placedAtSeconds: 0 },
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
        { id: 1, type: 'huchu', cell: { col: 1, row: 1 }, position: { x: Number.POSITIVE_INFINITY, y: 1.5 }, cooldownRemaining: 0, placedAtSeconds: 0 },
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
        { id: 1, type: 'huchu', cell: { col: 1, row: 1 }, position: { x: Number.MAX_VALUE, y: 1.5 }, cooldownRemaining: 0, placedAtSeconds: 0 },
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
    const center = projectWorldPoint(layout, { x: 0.5, y: 0.5 });

    expect(layout.dpr).toBe(2);
    expect(canvas.width).toBe(1688);
    expect(canvas.height).toBe(780);
    expect(center.x * layout.dpr).toBe(Math.round(center.x * layout.dpr));
    expect(center.y * layout.dpr).toBe(Math.round(center.y * layout.dpr));
  });
});
