import { describe, expect, it, vi } from 'vitest';
import { SoundEngine, type AudioContextLike } from '../../src/game/audio/SoundEngine';
import { FIXED_STEP_SECONDS } from '../../src/game/config';
import { createFixedStepLoop } from '../../src/game/core/fixedStepLoop';
import type { GameHitEvent, GameTower } from '../../src/game/simulation/createGame';
import {
  createFrameEventBuffer,
  createSlowPulse,
  effectForHit,
  effectsForTraits,
  SLOW_PULSE_DURATION_SECONDS,
  SLOW_PULSE_INTERVAL_SECONDS,
  slowPulseEffects,
  updateEffects,
} from '../../src/game/render/effects';

function tower(
  type: 'slow' | 'arrow',
  placedAtSeconds: number,
  id = 1,
): GameTower & { placedAtSeconds: number } {
  return {
    id,
    type,
    cell: { col: id, row: 1 },
    position: { x: id + 0.5, y: 1.5 },
    cooldownRemaining: 0,
    placedAtSeconds,
  };
}

describe('runtime effects', () => {
  it('removes an effect once its finite lifetime has elapsed', () => {
    const next = updateEffects([{ kind: 'splash', age: 0, duration: 0.4 }], 0.41);

    expect(next).toEqual([]);
  });

  it('advances effects without mutating the previous frame', () => {
    const current = [{ kind: 'impact', age: 0.1, duration: 0.4 }] as const;

    const next = updateEffects(current, 0.15);

    expect(current[0].age).toBe(0.1);
    expect(next).toEqual([{ kind: 'impact', age: 0.25, duration: 0.4 }]);
  });

  it('ignores invalid or negative frame deltas', () => {
    const current = [{ kind: 'pulse', age: 0.1, duration: 0.4 }];

    expect(updateEffects(current, Number.NaN)).toEqual(current);
    expect(updateEffects(current, -1)).toEqual(current);
  });

  it('creates distinct finite aqua, fire, arrow, and slow effects', () => {
    const position = { x: 2.5, y: 3.5 };
    const aqua = effectForHit({ kind: 'hit', towerType: 'huchu', position, radius: 1.25 });
    const fire = effectForHit({ kind: 'hit', towerType: 'deokbae', position, radius: 0.85 });
    const arrow = effectForHit({ kind: 'hit', towerType: 'arrow', position, radius: 0 });
    const slow = createSlowPulse(position);

    expect([aqua?.kind, fire?.kind, arrow?.kind, slow?.kind]).toEqual([
      'aqua-splash', 'fire-burst', 'arrow-impact', 'slow-pulse',
    ]);
    expect(updateEffects([aqua!, fire!, arrow!, slow!], 1)).toEqual([]);
  });

  it('uses the approved slow-pulse interval and duration', () => {
    expect(SLOW_PULSE_INTERVAL_SECONDS).toBe(3);
    expect(SLOW_PULSE_DURATION_SECONDS).toBe(0.6);
    expect(slowPulseEffects).toBeTypeOf('function');
  });

  it('shows a slow pulse immediately and at every three-second boundary', () => {
    expect(slowPulseEffects).toBeTypeOf('function');
    if (typeof slowPulseEffects !== 'function') return;
    const slowTower = tower('slow', 0);

    expect(slowPulseEffects([slowTower], 0)).toEqual([{
      kind: 'slow-pulse',
      position: { x: 1.5, y: 1.5 },
      age: 0,
      duration: 0.6,
    }]);
    expect(slowPulseEffects([slowTower], 0.599)[0].age).toBeCloseTo(0.599);
    expect(slowPulseEffects([slowTower], 0.6)).toEqual([]);
    expect(slowPulseEffects([slowTower], 3)[0].age).toBeCloseTo(0);
    expect(slowPulseEffects([slowTower], 3.599)[0].age).toBeCloseTo(0.599);
    expect(slowPulseEffects([slowTower], 3.6)).toEqual([]);
    expect(slowPulseEffects([slowTower], 6)[0].age).toBeCloseTo(0);
  });

  it('keeps tower pulse phases independent and excludes non-slow towers', () => {
    expect(slowPulseEffects).toBeTypeOf('function');
    if (typeof slowPulseEffects !== 'function') return;
    const towers = [
      tower('slow', 0, 1),
      tower('slow', 1, 2),
      tower('arrow', 3, 3),
    ];
    const before = structuredClone(towers);

    expect(slowPulseEffects(towers, 3.25).map((effect) => effect.position.x)).toEqual([1.5]);
    expect(slowPulseEffects(towers, 4.25).map((effect) => effect.position.x)).toEqual([2.5]);
    expect(towers).toEqual(before);
  });

  it('normalizes invalid clocks and times before the tower was placed', () => {
    expect(slowPulseEffects).toBeTypeOf('function');
    if (typeof slowPulseEffects !== 'function') return;

    expect(slowPulseEffects([tower('slow', Number.NaN)], Number.NaN)[0].age).toBe(0);
    expect(slowPulseEffects([tower('slow', 5)], 4)[0].age).toBe(0);
  });

  it('buffers every fixed-step hit, coalesces cue types, and clears after consumption or restart', async () => {
    const module = await import('../../src/game/render/effects');
    type BufferApi = {
      recordStep(step: {
        hitEvents: readonly GameHitEvent[];
        shot: boolean;
        leak: boolean;
      }): void;
      peek(): {
        hitEvents: readonly GameHitEvent[];
        traitEvents: readonly { kind: string; position: { x: number; y: number } }[];
        cueTypes: readonly string[];
      };
      clear(): void;
      reset(): void;
    };
    const createBuffer = (module as unknown as {
      createFrameEventBuffer(): BufferApi;
    }).createFrameEventBuffer;
    const buffer = createBuffer();
    const firstStep = [{
      kind: 'hit' as const,
      towerType: 'huchu' as const,
      position: { x: 1, y: 1 },
      radius: 1.25,
    }];

    let updateCount = 0;
    const renderedFrames: ReturnType<BufferApi['peek']>[] = [];
    const loop = createFixedStepLoop({
      update() {
        updateCount += 1;
        if (updateCount === 1) {
          buffer.recordStep({ hitEvents: firstStep, shot: true, leak: false });
          firstStep[0].position.x = 99;
          return;
        }
        buffer.recordStep({
          hitEvents: [
            { kind: 'hit', towerType: 'deokbae', position: { x: 2, y: 2 }, radius: 0.85 },
            { kind: 'hit', towerType: 'arrow', position: { x: 3, y: 3 }, radius: 0 },
          ],
          shot: true,
          leak: true,
        });
      },
      render() {
        renderedFrames.push(buffer.peek());
        buffer.clear();
      },
    });
    loop.tick(FIXED_STEP_SECONDS * 2);

    expect(updateCount).toBe(2);
    expect(renderedFrames).toHaveLength(1);
    const [frame] = renderedFrames;
    expect(frame.hitEvents).toHaveLength(3);
    expect(frame.hitEvents[0]).toMatchObject({ towerType: 'huchu', position: { x: 1, y: 1 } });
    expect(frame.cueTypes).toEqual(['shot', 'hit', 'leak']);
    expect(frame.hitEvents.map((event) => effectForHit(event)?.kind)).toEqual([
      'aqua-splash', 'fire-burst', 'arrow-impact',
    ]);

    loop.tick(0);
    expect(renderedFrames[1]).toEqual({ hitEvents: [], traitEvents: [], cueTypes: [] });
    buffer.recordStep({ hitEvents: firstStep, shot: true, leak: false });
    buffer.reset();
    expect(buffer.peek()).toEqual({ hitEvents: [], traitEvents: [], cueTypes: [] });
  });

  it('buffers trait events across fixed steps and maps them to finite visual effects', () => {
    const buffer = createFrameEventBuffer();
    const traitEvents = [{
      kind: 'shield-break' as const,
      enemyId: 1,
      position: { x: 2.5, y: 3.5 },
    }, {
      kind: 'lich-aura' as const,
      enemyId: 2,
      position: { x: 4.5, y: 5.5 },
      radius: 2.7,
    }];

    buffer.recordStep({
      hitEvents: [],
      traitEvents,
      shot: false,
      leak: false,
    });
    traitEvents[0].position.x = 99;

    expect(buffer.peek().traitEvents).toEqual([
      {
        kind: 'shield-break',
        enemyId: 1,
        position: { x: 2.5, y: 3.5 },
      },
      {
        kind: 'lich-aura',
        enemyId: 2,
        position: { x: 4.5, y: 5.5 },
        radius: 2.7,
      },
    ]);
    expect(effectsForTraits(buffer.peek().traitEvents)).toEqual([
      {
        kind: 'shield-break',
        position: { x: 2.5, y: 3.5 },
        radius: 0,
        age: 0,
        duration: 0.24,
      },
      {
        kind: 'lich-aura',
        position: { x: 4.5, y: 5.5 },
        radius: 2.7,
        age: 0,
        duration: 0.4,
      },
    ]);

    buffer.clear();
    expect(buffer.peek().traitEvents).toEqual([]);
  });

  it('does not turn the shadow-slime onboarding event into a canvas effect', () => {
    expect(effectsForTraits([{
      kind: 'split-open',
      enemyId: 1,
      position: { x: 0.5, y: 0.5 },
    }])).toEqual([]);
  });

  it('ignores non-visual damage and invalid trait event coordinates', () => {
    expect(effectsForTraits([
      { kind: 'damage', enemyId: 1, position: { x: 1, y: 1 } },
      { kind: 'split', enemyId: 2, position: { x: Number.NaN, y: 1 } },
    ])).toEqual([]);
  });
});

describe('SoundEngine', () => {
  it('creates its audio context lazily when explicitly unlocked by a gesture', async () => {
    const context = fakeAudioContext();
    const factory = vi.fn(() => context);
    const sound = new SoundEngine(factory);

    sound.play('placement');
    expect(factory).not.toHaveBeenCalled();

    await sound.unlock();
    expect(factory).toHaveBeenCalledOnce();
  });

  it('stays silent while muted and tolerates an unavailable audio context', async () => {
    const context = fakeAudioContext();
    const sound = new SoundEngine(() => context);
    await sound.unlock();
    sound.setMuted(true);

    expect(() => sound.play('hit')).not.toThrow();
    expect(context.createOscillator).not.toHaveBeenCalled();

    const unavailable = new SoundEngine(() => null);
    await expect(unavailable.unlock()).resolves.toBeUndefined();
    expect(() => unavailable.play('victory')).not.toThrow();
  });

  it('resumes a suspended context during gesture unlock', async () => {
    const context = fakeAudioContext();
    Object.defineProperty(context, 'state', { value: 'suspended' });
    const sound = new SoundEngine(() => context);

    await sound.unlock();

    expect(context.resume).toHaveBeenCalledOnce();
  });

  it('drops suspended play cues while sharing one in-flight gesture resume', async () => {
    let state: AudioContextState = 'suspended';
    let resolveResume: (() => void) | undefined;
    const resumeDone = new Promise<void>((resolve) => { resolveResume = resolve; });
    const context = fakeAudioContext();
    Object.defineProperty(context, 'state', { get: () => state });
    vi.mocked(context.resume).mockImplementation(() => resumeDone);
    const sound = new SoundEngine(() => context);

    const firstUnlock = sound.unlock();
    const secondUnlock = sound.unlock();
    sound.play('hit');

    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.createOscillator).not.toHaveBeenCalled();
    state = 'running';
    resolveResume?.();
    await Promise.all([firstUnlock, secondUnlock]);
    expect(context.createOscillator).not.toHaveBeenCalled();

    sound.play('hit');
    expect(context.createOscillator).toHaveBeenCalledOnce();
  });

  it('resets a rejected resume so a later gesture can retry', async () => {
    const context = fakeAudioContext();
    Object.defineProperty(context, 'state', { value: 'suspended' });
    vi.mocked(context.resume)
      .mockRejectedValueOnce(new Error('gesture expired'))
      .mockResolvedValueOnce(undefined);
    const sound = new SoundEngine(() => context);

    await sound.unlock();
    await sound.unlock();

    expect(context.resume).toHaveBeenCalledTimes(2);
  });

  it('keeps a new context resume shared when an old destroyed context resolves later', async () => {
    let resolveFirst: (() => void) | undefined;
    let resolveSecond: (() => void) | undefined;
    const firstResume = new Promise<void>((resolve) => { resolveFirst = resolve; });
    const secondResume = new Promise<void>((resolve) => { resolveSecond = resolve; });
    const first = fakeAudioContext();
    const second = fakeAudioContext();
    Object.defineProperty(first, 'state', { value: 'suspended' });
    Object.defineProperty(second, 'state', { value: 'suspended' });
    vi.mocked(first.resume).mockImplementation(() => firstResume);
    vi.mocked(second.resume).mockImplementation(() => secondResume);
    const factory = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    const sound = new SoundEngine(factory);

    const oldUnlock = sound.unlock();
    await sound.destroy();
    const newUnlock = sound.unlock();
    resolveFirst?.();
    await oldUnlock;
    const sharedNewUnlock = sound.unlock();

    expect(second.resume).toHaveBeenCalledOnce();
    resolveSecond?.();
    await Promise.all([newUnlock, sharedNewUnlock]);
  });
});

function fakeAudioContext(): AudioContextLike {
  const gain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
  const oscillator = {
    type: 'sine' as OscillatorType,
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  return {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    createGain: vi.fn(() => gain),
    createOscillator: vi.fn(() => oscillator),
  };
}
