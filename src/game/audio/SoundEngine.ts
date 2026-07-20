export type AudioParamLike = Readonly<{
  setValueAtTime(value: number, startTime: number): void;
  exponentialRampToValueAtTime(value: number, endTime: number): void;
}>;

export type OscillatorLike = {
  type: OscillatorType;
  readonly frequency: AudioParamLike;
  connect(destination: unknown): void;
  start(when?: number): void;
  stop(when?: number): void;
};

export type GainLike = Readonly<{
  gain: AudioParamLike;
  connect(destination: unknown): void;
}>;

export type AudioContextLike = Readonly<{
  state: AudioContextState;
  currentTime: number;
  destination: unknown;
  resume(): Promise<void>;
  close(): Promise<void>;
  createGain(): GainLike;
  createOscillator(): OscillatorLike;
}>;

export type SoundCue = 'placement' | 'shot' | 'hit' | 'leak' | 'victory' | 'defeat';

type Tone = Readonly<{
  frequency: number;
  endFrequency: number;
  duration: number;
  gain: number;
  offset?: number;
  type: OscillatorType;
}>;

const CUES: Readonly<Record<SoundCue, readonly Tone[]>> = {
  placement: [{ frequency: 330, endFrequency: 520, duration: 0.09, gain: 0.055, type: 'sine' }],
  shot: [{ frequency: 760, endFrequency: 430, duration: 0.045, gain: 0.025, type: 'square' }],
  hit: [{ frequency: 180, endFrequency: 95, duration: 0.07, gain: 0.04, type: 'triangle' }],
  leak: [{ frequency: 150, endFrequency: 62, duration: 0.24, gain: 0.07, type: 'sawtooth' }],
  victory: [
    { frequency: 523, endFrequency: 523, duration: 0.12, gain: 0.05, type: 'sine' },
    { frequency: 784, endFrequency: 784, duration: 0.24, gain: 0.06, offset: 0.12, type: 'sine' },
  ],
  defeat: [
    { frequency: 260, endFrequency: 180, duration: 0.18, gain: 0.055, type: 'triangle' },
    { frequency: 180, endFrequency: 70, duration: 0.32, gain: 0.06, offset: 0.16, type: 'triangle' },
  ],
};

function browserAudioContext(): AudioContextLike | null {
  const scope = globalThis as typeof globalThis & {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  const Constructor = scope.AudioContext ?? scope.webkitAudioContext;
  if (Constructor === undefined) return null;
  return new Constructor() as unknown as AudioContextLike;
}

export class SoundEngine {
  private context: AudioContextLike | null = null;
  private muted = false;

  constructor(private readonly factory: () => AudioContextLike | null = browserAudioContext) {}

  async unlock(): Promise<void> {
    if (this.context === null) {
      try {
        this.context = this.factory();
      } catch {
        this.context = null;
      }
    }
    if (this.context?.state === 'suspended') {
      try {
        await this.context.resume();
      } catch {
        // Browsers may reject resume when the gesture is no longer active.
      }
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  play(cue: SoundCue): void {
    const context = this.context;
    if (context === null || this.muted) return;
    if (context.state === 'suspended') {
      void context.resume().then(() => {
        if (!this.muted && this.context === context) this.emit(context, cue);
      }).catch(() => undefined);
      return;
    }
    if (context.state !== 'running') return;
    this.emit(context, cue);
  }

  async destroy(): Promise<void> {
    const context = this.context;
    this.context = null;
    if (context === null || context.state === 'closed') return;
    try {
      await context.close();
    } catch {
      // Closing is best-effort during page teardown.
    }
  }

  private emit(context: AudioContextLike, cue: SoundCue): void {
    try {
      for (const tone of CUES[cue]) {
        const start = context.currentTime + (tone.offset ?? 0);
        const end = start + tone.duration;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = tone.type;
        oscillator.frequency.setValueAtTime(tone.frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.endFrequency), end);
        gain.gain.setValueAtTime(tone.gain, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(end);
      }
    } catch {
      // Audio is optional; unsupported partial implementations stay silent.
    }
  }
}
