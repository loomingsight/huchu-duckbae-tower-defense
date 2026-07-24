import type { GameMode } from '../stages/stageIdentity';

export const MUSIC_TRACK_IDS = [
  'normalBattle',
  'nightmareBattle',
  'normalBoss',
  'nightmareBoss',
] as const;

export type MusicTrackId = (typeof MUSIC_TRACK_IDS)[number];
export type MusicInstrument = 'pluck' | 'bell' | 'bass' | 'pad' | 'percussion';
export type PercussionPreset = 'kick' | 'tick';

type MusicEventBase = Readonly<{
  beat: number;
  durationBeats: number;
  accent?: number;
}>;

export type NoteMusicEvent = MusicEventBase & Readonly<{
  kind: 'note';
  degree: number;
  octave: number;
}>;

export type PercussionMusicEvent = MusicEventBase & Readonly<{
  kind: 'percussion';
  preset: PercussionPreset;
}>;

export type MusicEvent = NoteMusicEvent | PercussionMusicEvent;

export type MusicLayer = Readonly<{
  instrument: MusicInstrument;
  waveform: OscillatorType;
  gain: number;
  events: readonly MusicEvent[];
}>;

export type MusicTrack = Readonly<{
  id: MusicTrackId;
  bpm: number;
  beatsPerBar: 4;
  bars: 16;
  rootMidi: number;
  scale: readonly number[];
  layers: readonly MusicLayer[];
}>;

type NotePattern = readonly Readonly<{
  beat: number;
  durationBeats: number;
  degree: number;
  octave: number;
  accent?: number;
}>[];

type PercussionPattern = readonly Readonly<{
  beat: number;
  durationBeats: number;
  preset: PercussionPreset;
  accent?: number;
}>[];

const SUPPORTED_WAVEFORMS = new Set<OscillatorType>([
  'sine',
  'triangle',
  'square',
  'sawtooth',
]);
const SUPPORTED_INSTRUMENTS = new Set<MusicInstrument>([
  'pluck',
  'bell',
  'bass',
  'pad',
  'percussion',
]);
const SUPPORTED_PERCUSSION = new Set<PercussionPreset>(['kick', 'tick']);
const TOTAL_BEATS = 64;
const MAX_SIMULTANEOUS_EVENTS = 12;

function repeatNotes(
  pattern: NotePattern,
  spanBeats: number,
  repeats: number,
): readonly NoteMusicEvent[] {
  const events: NoteMusicEvent[] = [];
  for (let repeat = 0; repeat < repeats; repeat += 1) {
    for (const event of pattern) {
      events.push({
        kind: 'note',
        ...event,
        beat: event.beat + repeat * spanBeats,
      });
    }
  }
  return events;
}

function repeatPercussion(
  pattern: PercussionPattern,
  spanBeats: number,
  repeats: number,
): readonly PercussionMusicEvent[] {
  const events: PercussionMusicEvent[] = [];
  for (let repeat = 0; repeat < repeats; repeat += 1) {
    for (const event of pattern) {
      events.push({
        kind: 'percussion',
        ...event,
        beat: event.beat + repeat * spanBeats,
      });
    }
  }
  return events;
}

function noteLayer(
  instrument: Exclude<MusicInstrument, 'percussion'>,
  waveform: OscillatorType,
  gain: number,
  pattern: NotePattern,
  spanBeats = 4,
  repeats = TOTAL_BEATS / spanBeats,
): MusicLayer {
  return {
    instrument,
    waveform,
    gain,
    events: repeatNotes(pattern, spanBeats, repeats),
  };
}

function percussionLayer(
  gain: number,
  pattern: PercussionPattern,
  spanBeats = 4,
  repeats = TOTAL_BEATS / spanBeats,
): MusicLayer {
  return {
    instrument: 'percussion',
    waveform: 'square',
    gain,
    events: repeatPercussion(pattern, spanBeats, repeats),
  };
}

const NORMAL_BATTLE: MusicTrack = {
  id: 'normalBattle',
  bpm: 96,
  beatsPerBar: 4,
  bars: 16,
  rootMidi: 62,
  scale: [0, 2, 4, 5, 7, 9, 11],
  layers: [
    noteLayer('pluck', 'triangle', 0.042, [
      { beat: 0, durationBeats: 0.28, degree: 0, octave: 0, accent: 1.1 },
      { beat: 0.5, durationBeats: 0.24, degree: 2, octave: 0 },
      { beat: 1, durationBeats: 0.28, degree: 4, octave: 0 },
      { beat: 1.5, durationBeats: 0.24, degree: 2, octave: 0 },
      { beat: 2, durationBeats: 0.28, degree: 5, octave: 0, accent: 1.08 },
      { beat: 2.5, durationBeats: 0.24, degree: 4, octave: 0 },
      { beat: 3, durationBeats: 0.28, degree: 2, octave: 0 },
      { beat: 3.5, durationBeats: 0.24, degree: 4, octave: 0 },
    ]),
    noteLayer('bell', 'sine', 0.034, [
      { beat: 0, durationBeats: 0.72, degree: 0, octave: 1 },
      { beat: 2, durationBeats: 0.72, degree: 4, octave: 1 },
      { beat: 4, durationBeats: 0.72, degree: 5, octave: 1 },
      { beat: 6, durationBeats: 0.72, degree: 4, octave: 1 },
    ], 8, 8),
    noteLayer('bass', 'triangle', 0.055, [
      { beat: 0, durationBeats: 1.4, degree: 0, octave: -2, accent: 1.1 },
      { beat: 2, durationBeats: 1.4, degree: 4, octave: -2 },
    ]),
    percussionLayer(0.03, [
      { beat: 0, durationBeats: 0.12, preset: 'kick', accent: 1.15 },
      { beat: 1, durationBeats: 0.08, preset: 'tick' },
      { beat: 2, durationBeats: 0.12, preset: 'kick' },
      { beat: 3, durationBeats: 0.08, preset: 'tick' },
    ]),
  ],
};

const NIGHTMARE_BATTLE: MusicTrack = {
  id: 'nightmareBattle',
  bpm: 88,
  beatsPerBar: 4,
  bars: 16,
  rootMidi: 62,
  scale: [0, 2, 3, 5, 7, 8, 10],
  layers: [
    noteLayer('bell', 'sine', 0.033, [
      { beat: 0, durationBeats: 0.56, degree: 0, octave: 1 },
      { beat: 1.5, durationBeats: 0.42, degree: 2, octave: 1 },
      { beat: 3, durationBeats: 0.65, degree: 5, octave: 0 },
      { beat: 4, durationBeats: 0.56, degree: 6, octave: 0 },
      { beat: 5.5, durationBeats: 0.42, degree: 4, octave: 0 },
      { beat: 7, durationBeats: 0.65, degree: 1, octave: 1 },
    ], 8, 8),
    noteLayer('bass', 'square', 0.04, [
      { beat: 0, durationBeats: 1.55, degree: 0, octave: -2, accent: 1.08 },
      { beat: 2, durationBeats: 1.35, degree: 0, octave: -2 },
    ]),
    noteLayer('pad', 'triangle', 0.025, [
      { beat: 0, durationBeats: 3.6, degree: 0, octave: -1 },
      { beat: 4, durationBeats: 3.6, degree: 5, octave: -1 },
    ], 8, 8),
    percussionLayer(0.025, [
      { beat: 0, durationBeats: 0.13, preset: 'kick' },
      { beat: 2.5, durationBeats: 0.08, preset: 'tick' },
    ]),
  ],
};

const NORMAL_BOSS: MusicTrack = {
  id: 'normalBoss',
  bpm: 124,
  beatsPerBar: 4,
  bars: 16,
  rootMidi: 59,
  scale: [0, 2, 3, 5, 7, 8, 10],
  layers: [
    noteLayer('pluck', 'sawtooth', 0.032, [
      { beat: 0, durationBeats: 0.2, degree: 0, octave: 0, accent: 1.12 },
      { beat: 0.5, durationBeats: 0.2, degree: 2, octave: 0 },
      { beat: 1, durationBeats: 0.2, degree: 4, octave: 0 },
      { beat: 1.5, durationBeats: 0.2, degree: 6, octave: 0 },
      { beat: 2, durationBeats: 0.2, degree: 4, octave: 1, accent: 1.08 },
      { beat: 2.5, durationBeats: 0.2, degree: 2, octave: 1 },
      { beat: 3, durationBeats: 0.2, degree: 6, octave: 0 },
      { beat: 3.5, durationBeats: 0.2, degree: 4, octave: 0 },
    ]),
    noteLayer('bell', 'sine', 0.03, [
      { beat: 0, durationBeats: 0.5, degree: 0, octave: 1 },
      { beat: 1, durationBeats: 0.42, degree: 4, octave: 1 },
      { beat: 2, durationBeats: 0.5, degree: 5, octave: 1 },
      { beat: 3, durationBeats: 0.42, degree: 6, octave: 1 },
    ]),
    noteLayer('bass', 'square', 0.045, [
      { beat: 0, durationBeats: 0.8, degree: 0, octave: -2, accent: 1.12 },
      { beat: 1, durationBeats: 0.75, degree: 0, octave: -2 },
      { beat: 2, durationBeats: 0.8, degree: 4, octave: -2 },
      { beat: 3, durationBeats: 0.75, degree: 4, octave: -2 },
    ]),
    percussionLayer(0.035, [
      { beat: 0, durationBeats: 0.12, preset: 'kick', accent: 1.2 },
      { beat: 0.5, durationBeats: 0.07, preset: 'tick' },
      { beat: 1, durationBeats: 0.07, preset: 'tick' },
      { beat: 2, durationBeats: 0.12, preset: 'kick', accent: 1.1 },
      { beat: 2.5, durationBeats: 0.07, preset: 'tick' },
      { beat: 3, durationBeats: 0.07, preset: 'tick' },
    ]),
  ],
};

const NIGHTMARE_BOSS: MusicTrack = {
  id: 'nightmareBoss',
  bpm: 132,
  beatsPerBar: 4,
  bars: 16,
  rootMidi: 62,
  scale: [0, 2, 3, 5, 7, 8, 11],
  layers: [
    noteLayer('pluck', 'square', 0.029, [
      { beat: 0, durationBeats: 0.18, degree: 0, octave: 0, accent: 1.15 },
      { beat: 0.5, durationBeats: 0.18, degree: 1, octave: 0 },
      { beat: 1, durationBeats: 0.18, degree: 5, octave: 0 },
      { beat: 1.5, durationBeats: 0.18, degree: 6, octave: 0 },
      { beat: 2, durationBeats: 0.18, degree: 0, octave: 1, accent: 1.12 },
      { beat: 2.5, durationBeats: 0.18, degree: 6, octave: 0 },
      { beat: 3, durationBeats: 0.18, degree: 5, octave: 0 },
      { beat: 3.5, durationBeats: 0.18, degree: 1, octave: 0 },
    ]),
    noteLayer('bell', 'sine', 0.028, [
      { beat: 0, durationBeats: 0.42, degree: 0, octave: 1 },
      { beat: 1.5, durationBeats: 0.34, degree: 6, octave: 1 },
      { beat: 2.5, durationBeats: 0.34, degree: 2, octave: 1 },
      { beat: 3.5, durationBeats: 0.3, degree: 5, octave: 1 },
    ]),
    noteLayer('bass', 'sawtooth', 0.038, [
      { beat: 0, durationBeats: 0.7, degree: 0, octave: -2, accent: 1.16 },
      { beat: 1, durationBeats: 0.65, degree: 0, octave: -2 },
      { beat: 2, durationBeats: 0.7, degree: 5, octave: -2 },
      { beat: 3, durationBeats: 0.65, degree: 6, octave: -2 },
    ]),
    noteLayer('pad', 'triangle', 0.02, [
      { beat: 0, durationBeats: 3.7, degree: 0, octave: -1 },
      { beat: 4, durationBeats: 3.7, degree: 6, octave: -1 },
    ], 8, 8),
    percussionLayer(0.032, [
      { beat: 0, durationBeats: 0.11, preset: 'kick', accent: 1.2 },
      { beat: 0.5, durationBeats: 0.06, preset: 'tick' },
      { beat: 1, durationBeats: 0.06, preset: 'tick' },
      { beat: 1.5, durationBeats: 0.06, preset: 'tick' },
      { beat: 2, durationBeats: 0.11, preset: 'kick', accent: 1.15 },
      { beat: 2.5, durationBeats: 0.06, preset: 'tick' },
      { beat: 3, durationBeats: 0.06, preset: 'tick' },
      { beat: 3.5, durationBeats: 0.06, preset: 'tick' },
    ]),
  ],
};

export const MUSIC_TRACKS: Readonly<Record<MusicTrackId, MusicTrack>> = {
  normalBattle: NORMAL_BATTLE,
  nightmareBattle: NIGHTMARE_BATTLE,
  normalBoss: NORMAL_BOSS,
  nightmareBoss: NIGHTMARE_BOSS,
};

function isFiniteInRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function hasValidEvent(track: MusicTrack, event: MusicEvent): boolean {
  const totalBeats = track.beatsPerBar * track.bars;
  if (
    !isFiniteInRange(event.beat, 0, totalBeats)
    || !Number.isFinite(event.durationBeats)
    || event.durationBeats <= 0
    || event.beat >= totalBeats
    || event.beat + event.durationBeats > totalBeats
    || (event.accent !== undefined && !isFiniteInRange(event.accent, 0.1, 1.5))
  ) return false;
  if (event.kind === 'percussion') return SUPPORTED_PERCUSSION.has(event.preset);
  return Number.isInteger(event.degree)
    && event.degree >= 0
    && event.degree < track.scale.length
    && Number.isInteger(event.octave)
    && event.octave >= -3
    && event.octave <= 3;
}

function maximumSimultaneousEvents(track: MusicTrack): number {
  const events = track.layers.flatMap((layer) => layer.events);
  let maximum = 0;
  for (const event of events) {
    const simultaneous = events.filter((candidate) => (
      candidate.beat <= event.beat
      && candidate.beat + candidate.durationBeats > event.beat
    )).length;
    maximum = Math.max(maximum, simultaneous);
  }
  return maximum;
}

export function validateMusicTrack(track: MusicTrack): boolean {
  if (
    !(MUSIC_TRACK_IDS as readonly string[]).includes(track.id)
    || !isFiniteInRange(track.bpm, 40, 240)
    || track.beatsPerBar !== 4
    || track.bars !== 16
    || !Number.isInteger(track.rootMidi)
    || !isFiniteInRange(track.rootMidi, 12, 108)
    || track.scale.length === 0
    || track.scale.some((interval) => (
      !Number.isInteger(interval) || interval < 0 || interval > 11
    ))
    || track.layers.length === 0
  ) return false;

  for (const layer of track.layers) {
    if (
      !SUPPORTED_INSTRUMENTS.has(layer.instrument)
      || !SUPPORTED_WAVEFORMS.has(layer.waveform)
      || !isFiniteInRange(layer.gain, 0.001, 0.2)
      || layer.events.length === 0
      || layer.events.some((event) => !hasValidEvent(track, event))
      || (layer.instrument === 'percussion'
        ? layer.events.some((event) => event.kind !== 'percussion')
        : layer.events.some((event) => event.kind !== 'note'))
    ) return false;
  }

  return track.layers.reduce((sum, layer) => sum + layer.gain, 0) <= 0.6
    && maximumSimultaneousEvents(track) <= MAX_SIMULTANEOUS_EVENTS;
}

export function musicTrackIdFor(mode: GameMode, bossActive: boolean): MusicTrackId {
  if (mode === 'nightmare') return bossActive ? 'nightmareBoss' : 'nightmareBattle';
  return bossActive ? 'normalBoss' : 'normalBattle';
}
