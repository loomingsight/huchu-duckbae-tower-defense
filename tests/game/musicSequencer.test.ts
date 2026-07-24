import { describe, expect, it, vi } from 'vitest';

import {
  MUSIC_DUCK_RATIO,
  MUSIC_LOOKAHEAD_SECONDS,
  MUSIC_MASTER_GAIN,
  MusicSequencer,
} from '../../src/game/audio/MusicSequencer';
import type {
  AudioContextLike,
  AudioParamLike,
  GainLike,
  OscillatorLike,
} from '../../src/game/audio/SoundEngine';

type ParamCall = Readonly<{
  method: 'set' | 'exponential' | 'linear';
  value: number;
  time: number;
}>;

type FakeGain = GainLike & Readonly<{
  calls: ParamCall[];
  disconnect: ReturnType<typeof vi.fn>;
}>;

type FakeOscillator = OscillatorLike & Readonly<{
  starts: number[];
  stops: number[];
}>;

function createFakeAudioContext() {
  let now = 0;
  let failOscillator = false;
  const gains: FakeGain[] = [];
  const oscillators: FakeOscillator[] = [];
  const createParam = (calls: ParamCall[]): AudioParamLike => ({
    setValueAtTime(value, time) {
      calls.push({ method: 'set', value, time });
    },
    exponentialRampToValueAtTime(value, time) {
      calls.push({ method: 'exponential', value, time });
    },
    linearRampToValueAtTime(value, time) {
      calls.push({ method: 'linear', value, time });
    },
  });
  const context: AudioContextLike = {
    state: 'running',
    get currentTime() { return now; },
    destination: {},
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    createGain: vi.fn(() => {
      const calls: ParamCall[] = [];
      const gain: FakeGain = {
        gain: createParam(calls),
        connect: vi.fn(),
        disconnect: vi.fn(),
        calls,
      };
      gains.push(gain);
      return gain;
    }),
    createOscillator: vi.fn(() => {
      if (failOscillator) throw new Error('oscillator unavailable');
      const frequencyCalls: ParamCall[] = [];
      const starts: number[] = [];
      const stops: number[] = [];
      const oscillator: FakeOscillator = {
        type: 'sine',
        frequency: createParam(frequencyCalls),
        connect: vi.fn(),
        start: (when = 0) => { starts.push(when); },
        stop: (when = 0) => { stops.push(when); },
        starts,
        stops,
      };
      oscillators.push(oscillator);
      return oscillator;
    }),
  };
  return {
    context,
    gains,
    oscillators,
    setTime(value: number) { now = value; },
    setFailOscillator(value: boolean) { failOscillator = value; },
  };
}

function hasRamp(
  gain: FakeGain,
  value: number,
  time: number,
): boolean {
  return gain.calls.some((call) => (
    call.method === 'linear'
    && Math.abs(call.value - value) < 0.000_001
    && Math.abs(call.time - time) < 0.000_001
  ));
}

function maximumScheduledOverlap(oscillators: readonly FakeOscillator[]): number {
  const spans = oscillators.flatMap((oscillator) => (
    oscillator.starts.length === 0 || oscillator.stops.length === 0
      ? []
      : [{ start: oscillator.starts[0], end: oscillator.stops[0] }]
  ));
  let maximum = 0;
  for (const span of spans) {
    maximum = Math.max(maximum, spans.filter((candidate) => (
      candidate.start <= span.start && candidate.end > span.start
    )).length);
  }
  return maximum;
}

describe('MusicSequencer', () => {
  it('fades in the first track and only schedules inside the look-ahead window', () => {
    const fake = createFakeAudioContext();
    const sequencer = new MusicSequencer(fake.context);
    const master = fake.gains[0];

    sequencer.setTrack('normalBattle');
    const voice = fake.gains[1];
    sequencer.tick();

    expect(master.calls).toContainEqual({ method: 'set', value: MUSIC_MASTER_GAIN, time: 0 });
    expect(voice.calls).toContainEqual({ method: 'set', value: 0, time: 0 });
    expect(hasRamp(voice, 1, 0.25)).toBe(true);
    expect(fake.oscillators.length).toBeGreaterThan(0);
    expect(fake.oscillators.every(({ starts }) => (
      starts[0] >= 0 && starts[0] <= MUSIC_LOOKAHEAD_SECONDS
    ))).toBe(true);

    const gainCount = fake.gains.length;
    const oscillatorCount = fake.oscillators.length;
    sequencer.setTrack('normalBattle');
    sequencer.tick();
    expect(fake.gains).toHaveLength(gainCount);
    expect(fake.oscillators).toHaveLength(oscillatorCount);
  });

  it('crossfades to a boss track once without restarting identical tracks', () => {
    const fake = createFakeAudioContext();
    const sequencer = new MusicSequencer(fake.context);
    sequencer.setTrack('normalBattle');
    const battleVoice = fake.gains[1];
    sequencer.tick();
    fake.setTime(0.1);
    const gainCount = fake.gains.length;

    sequencer.setTrack('normalBoss', 1);
    const bossVoice = fake.gains[gainCount];

    expect(hasRamp(battleVoice, 0, 1.1)).toBe(true);
    expect(bossVoice.calls).toContainEqual({ method: 'set', value: 0, time: 0.1 });
    expect(hasRamp(bossVoice, 1, 1.1)).toBe(true);

    const afterTransition = fake.gains.length;
    sequencer.setTrack('normalBoss', 1);
    expect(fake.gains).toHaveLength(afterTransition);
  });

  it('ducks the master to thirty percent and restores it smoothly', () => {
    const fake = createFakeAudioContext();
    const sequencer = new MusicSequencer(fake.context);
    const master = fake.gains[0];

    sequencer.setDucked(true);
    expect(hasRamp(master, MUSIC_MASTER_GAIN * MUSIC_DUCK_RATIO, 0.2)).toBe(true);

    fake.setTime(0.2);
    sequencer.setDucked(false);
    expect(hasRamp(master, MUSIC_MASTER_GAIN, 0.4)).toBe(true);
  });

  it('stops scheduling while muted and restarts the desired track after unmute', () => {
    const fake = createFakeAudioContext();
    const sequencer = new MusicSequencer(fake.context);
    sequencer.setTrack('nightmareBattle');
    sequencer.tick();
    expect(fake.oscillators.length).toBeGreaterThan(0);

    sequencer.setMuted(true);
    expect(fake.oscillators.every(({ stops }) => stops.length > 0)).toBe(true);
    const mutedCount = fake.oscillators.length;
    fake.setTime(1);
    sequencer.tick();
    expect(fake.oscillators).toHaveLength(mutedCount);

    sequencer.setMuted(false);
    sequencer.tick();
    expect(fake.oscillators.length).toBeGreaterThan(mutedCount);
  });

  it('never schedules more than twelve overlapping oscillators', () => {
    const fake = createFakeAudioContext();
    const sequencer = new MusicSequencer(fake.context);
    sequencer.setTrack('nightmareBoss');

    for (const time of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      fake.setTime(time);
      sequencer.tick();
    }

    expect(maximumScheduledOverlap(fake.oscillators)).toBeLessThanOrEqual(12);
  });

  it('cleans active nodes on stop and destroy and tolerates partial audio failure', () => {
    const fake = createFakeAudioContext();
    const sequencer = new MusicSequencer(fake.context);
    sequencer.setTrack('normalBattle');
    sequencer.tick();

    expect(() => sequencer.setTrack(null)).not.toThrow();
    expect(fake.oscillators.every(({ stops }) => stops.length > 0)).toBe(true);

    fake.setFailOscillator(true);
    sequencer.setTrack('normalBoss');
    expect(() => sequencer.tick()).not.toThrow();
    expect(() => sequencer.destroy()).not.toThrow();
    expect(fake.gains[0].disconnect).toHaveBeenCalledOnce();
  });
});
