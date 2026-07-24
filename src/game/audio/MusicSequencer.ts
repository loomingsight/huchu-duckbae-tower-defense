import {
  MUSIC_TRACKS,
  validateMusicTrack,
  type MusicEvent,
  type MusicLayer,
  type MusicTrack,
  type MusicTrackId,
} from './musicTracks';
import type {
  AudioContextLike,
  GainLike,
  OscillatorLike,
} from './SoundEngine';

export const MUSIC_LOOKAHEAD_SECONDS = 0.35;
export const MUSIC_MASTER_GAIN = 0.16;
export const MUSIC_DUCK_RATIO = 0.3;

const FIRST_TRACK_FADE_SECONDS = 0.25;
const GAIN_RAMP_SECONDS = 0.2;
const START_DELAY_SECONDS = 0.02;
const MAX_ACTIVE_OSCILLATORS = 12;
const MIN_GAIN = 0.0001;

type ScheduledMusicEvent = Readonly<{
  event: MusicEvent;
  layer: MusicLayer;
}>;

type TrackVoice = {
  readonly id: number;
  readonly track: MusicTrack;
  readonly bus: GainLike;
  readonly events: readonly ScheduledMusicEvent[];
  loopStartTime: number;
  eventIndex: number;
  fadeEndTime: number | null;
};

type ActiveNode = Readonly<{
  oscillator: OscillatorLike;
  gain: GainLike;
  voiceId: number;
  endTime: number;
}>;

function finiteDuration(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function midiFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function flattenedEvents(track: MusicTrack): readonly ScheduledMusicEvent[] {
  return track.layers
    .flatMap((layer) => layer.events.map((event) => ({ event, layer })))
    .sort((left, right) => left.event.beat - right.event.beat);
}

export class MusicSequencer {
  private readonly master: GainLike;
  private voices: TrackVoice[] = [];
  private activeNodes: ActiveNode[] = [];
  private desiredTrackId: MusicTrackId | null = null;
  private nextVoiceId = 1;
  private muted = false;
  private ducked = false;
  private destroyed = false;

  constructor(private readonly context: AudioContextLike) {
    this.master = context.createGain();
    this.master.gain.setValueAtTime(MUSIC_MASTER_GAIN, context.currentTime);
    this.master.connect(context.destination);
  }

  setTrack(
    trackId: MusicTrackId | null,
    crossfadeSeconds = FIRST_TRACK_FADE_SECONDS,
  ): void {
    if (this.destroyed) return;
    if (trackId !== null) {
      const track = MUSIC_TRACKS[trackId];
      if (track === undefined || !validateMusicTrack(track)) return;
    }
    if (trackId === this.desiredTrackId) return;
    this.desiredTrackId = trackId;
    if (this.muted) {
      this.stopAllVoices();
      return;
    }
    if (trackId === null) {
      this.stopAllVoices();
      return;
    }

    const now = this.safeCurrentTime();
    const activeVoice = this.voices.find((voice) => voice.fadeEndTime === null);
    const fadeSeconds = activeVoice === undefined
      ? Math.min(FIRST_TRACK_FADE_SECONDS, finiteDuration(crossfadeSeconds, FIRST_TRACK_FADE_SECONDS))
      : finiteDuration(crossfadeSeconds, 1);
    if (activeVoice !== undefined) {
      this.fadeOutVoice(activeVoice, now, fadeSeconds);
    }
    this.startVoice(MUSIC_TRACKS[trackId], now, fadeSeconds);
  }

  setDucked(ducked: boolean): void {
    if (this.destroyed || ducked === this.ducked) return;
    this.ducked = ducked;
    const now = this.safeCurrentTime();
    const currentTarget = ducked ? MUSIC_MASTER_GAIN : MUSIC_MASTER_GAIN * MUSIC_DUCK_RATIO;
    const nextTarget = ducked ? MUSIC_MASTER_GAIN * MUSIC_DUCK_RATIO : MUSIC_MASTER_GAIN;
    try {
      this.master.gain.setValueAtTime(currentTarget, now);
      this.master.gain.linearRampToValueAtTime(nextTarget, now + GAIN_RAMP_SECONDS);
    } catch {
      // Music is optional; unsupported parameter ramps stay silent.
    }
  }

  setMuted(muted: boolean): void {
    if (this.destroyed || muted === this.muted) return;
    this.muted = muted;
    if (muted) {
      this.stopAllVoices();
      return;
    }
    const trackId = this.desiredTrackId;
    if (trackId !== null) {
      this.startVoice(MUSIC_TRACKS[trackId], this.safeCurrentTime(), FIRST_TRACK_FADE_SECONDS);
    }
  }

  tick(): void {
    if (this.destroyed || this.muted) return;
    const now = this.safeCurrentTime();
    this.pruneFinishedNodes(now);
    this.cleanupFadedVoices(now);
    const horizon = now + MUSIC_LOOKAHEAD_SECONDS;
    for (const voice of this.voices) {
      if (voice.fadeEndTime !== null) continue;
      this.scheduleVoice(voice, now, horizon);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.desiredTrackId = null;
    this.stopAllVoices();
    try {
      this.master.disconnect?.();
    } catch {
      // Disconnect is best-effort during page teardown.
    }
  }

  private safeCurrentTime(): number {
    return Number.isFinite(this.context.currentTime) && this.context.currentTime >= 0
      ? this.context.currentTime
      : 0;
  }

  private startVoice(track: MusicTrack, now: number, fadeSeconds: number): void {
    let bus: GainLike;
    try {
      bus = this.context.createGain();
      bus.gain.setValueAtTime(0, now);
      bus.gain.linearRampToValueAtTime(1, now + fadeSeconds);
      bus.connect(this.master);
    } catch {
      return;
    }
    this.voices.push({
      id: this.nextVoiceId,
      track,
      bus,
      events: flattenedEvents(track),
      loopStartTime: now + START_DELAY_SECONDS,
      eventIndex: 0,
      fadeEndTime: null,
    });
    this.nextVoiceId += 1;
  }

  private fadeOutVoice(voice: TrackVoice, now: number, fadeSeconds: number): void {
    voice.fadeEndTime = now + fadeSeconds;
    try {
      voice.bus.gain.setValueAtTime(1, now);
      voice.bus.gain.linearRampToValueAtTime(0, voice.fadeEndTime);
    } catch {
      this.stopVoice(voice);
    }
  }

  private scheduleVoice(voice: TrackVoice, now: number, horizon: number): void {
    if (voice.events.length === 0) return;
    const secondsPerBeat = 60 / voice.track.bpm;
    const loopDuration = voice.track.beatsPerBar * voice.track.bars * secondsPerBeat;
    if (now >= voice.loopStartTime + loopDuration) {
      const skippedLoops = Math.floor((now - voice.loopStartTime) / loopDuration);
      voice.loopStartTime += Math.max(1, skippedLoops) * loopDuration;
      voice.eventIndex = 0;
    }

    while (true) {
      const scheduled = voice.events[voice.eventIndex];
      const startTime = voice.loopStartTime + scheduled.event.beat * secondsPerBeat;
      if (startTime > horizon) return;
      if (startTime >= now - 0.03 && this.activeNodes.length < MAX_ACTIVE_OSCILLATORS) {
        this.scheduleEvent(voice, scheduled, startTime, secondsPerBeat);
      }
      this.advanceVoice(voice, loopDuration);
    }
  }

  private advanceVoice(voice: TrackVoice, loopDuration: number): void {
    voice.eventIndex += 1;
    if (voice.eventIndex < voice.events.length) return;
    voice.eventIndex = 0;
    voice.loopStartTime += loopDuration;
  }

  private scheduleEvent(
    voice: TrackVoice,
    scheduled: ScheduledMusicEvent,
    startTime: number,
    secondsPerBeat: number,
  ): void {
    let oscillator: OscillatorLike | null = null;
    let gain: GainLike | null = null;
    try {
      oscillator = this.context.createOscillator();
      gain = this.context.createGain();
      oscillator.type = scheduled.layer.waveform;
      const duration = Math.max(0.025, scheduled.event.durationBeats * secondsPerBeat);
      const endTime = startTime + duration;
      const accent = scheduled.event.accent ?? 1;
      const peakGain = Math.max(MIN_GAIN, scheduled.layer.gain * accent);
      if (scheduled.event.kind === 'percussion') {
        const startFrequency = scheduled.event.preset === 'kick' ? 145 : 920;
        const endFrequency = scheduled.event.preset === 'kick' ? 52 : 360;
        oscillator.frequency.setValueAtTime(startFrequency, startTime);
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, endTime);
      } else {
        const midi = voice.track.rootMidi
          + voice.track.scale[scheduled.event.degree]
          + scheduled.event.octave * 12;
        oscillator.frequency.setValueAtTime(midiFrequency(midi), startTime);
      }
      const attackEnd = Math.min(endTime, startTime + Math.min(0.018, duration * 0.2));
      gain.gain.setValueAtTime(MIN_GAIN, startTime);
      gain.gain.linearRampToValueAtTime(peakGain, attackEnd);
      gain.gain.exponentialRampToValueAtTime(MIN_GAIN, endTime);
      oscillator.connect(gain);
      gain.connect(voice.bus);
      oscillator.start(startTime);
      oscillator.stop(endTime);
      this.activeNodes.push({
        oscillator,
        gain,
        voiceId: voice.id,
        endTime,
      });
    } catch {
      try {
        oscillator?.stop(startTime);
      } catch {
        // A partially-created oscillator may not support stop.
      }
      try {
        gain?.disconnect?.();
      } catch {
        // A partially-created gain may not support disconnect.
      }
    }
  }

  private pruneFinishedNodes(now: number): void {
    const remaining: ActiveNode[] = [];
    for (const node of this.activeNodes) {
      if (node.endTime > now) {
        remaining.push(node);
        continue;
      }
      try {
        node.gain.disconnect?.();
      } catch {
        // Natural node cleanup is best-effort.
      }
    }
    this.activeNodes = remaining;
  }

  private cleanupFadedVoices(now: number): void {
    for (const voice of [...this.voices]) {
      if (voice.fadeEndTime !== null && voice.fadeEndTime <= now) this.stopVoice(voice);
    }
  }

  private stopVoice(voice: TrackVoice): void {
    const remaining: ActiveNode[] = [];
    for (const node of this.activeNodes) {
      if (node.voiceId !== voice.id) {
        remaining.push(node);
        continue;
      }
      try {
        node.oscillator.stop(this.safeCurrentTime());
      } catch {
        // A node can already be stopped by the browser.
      }
      try {
        node.gain.disconnect?.();
      } catch {
        // Disconnect is best-effort.
      }
    }
    this.activeNodes = remaining;
    try {
      voice.bus.disconnect?.();
    } catch {
      // Disconnect is best-effort.
    }
    this.voices = this.voices.filter((candidate) => candidate !== voice);
  }

  private stopAllVoices(): void {
    for (const voice of [...this.voices]) this.stopVoice(voice);
    this.voices = [];
    this.activeNodes = [];
  }
}
