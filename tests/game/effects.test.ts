import { describe, expect, it, vi } from 'vitest';
import { SoundEngine, type AudioContextLike } from '../../src/game/audio/SoundEngine';
import { updateEffects } from '../../src/game/render/effects';

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
