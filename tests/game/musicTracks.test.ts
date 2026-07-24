import { describe, expect, it } from 'vitest';

import {
  MUSIC_TRACK_IDS,
  MUSIC_TRACKS,
  musicTrackIdFor,
  validateMusicTrack,
  type MusicTrack,
} from '../../src/game/audio/musicTracks';

describe('procedural music tracks', () => {
  it('defines the four approved mode and boss tracks', () => {
    expect(MUSIC_TRACK_IDS).toEqual([
      'normalBattle',
      'nightmareBattle',
      'normalBoss',
      'nightmareBoss',
    ]);
    expect(musicTrackIdFor('normal', false)).toBe('normalBattle');
    expect(musicTrackIdFor('normal', true)).toBe('normalBoss');
    expect(musicTrackIdFor('nightmare', false)).toBe('nightmareBattle');
    expect(musicTrackIdFor('nightmare', true)).toBe('nightmareBoss');
  });

  it('keeps every approved track valid, musical, and sixteen bars long', () => {
    const expected = {
      normalBattle: { bpm: 96, rootMidi: 62, scale: [0, 2, 4, 5, 7, 9, 11] },
      nightmareBattle: { bpm: 88, rootMidi: 62, scale: [0, 2, 3, 5, 7, 8, 10] },
      normalBoss: { bpm: 124, rootMidi: 59, scale: [0, 2, 3, 5, 7, 8, 10] },
      nightmareBoss: { bpm: 132, rootMidi: 62, scale: [0, 2, 3, 5, 7, 8, 11] },
    } as const;

    for (const id of MUSIC_TRACK_IDS) {
      const track = MUSIC_TRACKS[id];
      expect({
        bpm: track.bpm,
        rootMidi: track.rootMidi,
        scale: track.scale,
      }).toEqual(expected[id]);
      expect(track.beatsPerBar).toBe(4);
      expect(track.bars).toBe(16);
      expect(track.layers.length).toBeGreaterThan(0);
      expect(track.layers.every((layer) => layer.events.length > 0)).toBe(true);
      expect(validateMusicTrack(track)).toBe(true);
    }
  });

  it('rejects events outside the loop and unsupported oscillator waveforms', () => {
    const source = MUSIC_TRACKS.normalBattle;
    const outsideLoop: MusicTrack = {
      ...source,
      layers: [{
        ...source.layers[0],
        events: [{
          kind: 'note',
          beat: 63.75,
          durationBeats: 1,
          degree: 0,
          octave: 0,
        }],
      }],
    };
    const unsupportedWaveform: MusicTrack = {
      ...source,
      layers: [{
        ...source.layers[0],
        waveform: 'custom' as OscillatorType,
      }],
    };

    expect(validateMusicTrack(outsideLoop)).toBe(false);
    expect(validateMusicTrack(unsupportedWaveform)).toBe(false);
  });

  it('rejects more than twelve simultaneous events', () => {
    const source = MUSIC_TRACKS.normalBattle;
    const overcrowded: MusicTrack = {
      ...source,
      layers: Array.from({ length: 13 }, (_, index) => ({
        ...source.layers[0],
        gain: 0.01,
        events: [{
          kind: 'note' as const,
          beat: 0,
          durationBeats: 1,
          degree: index % source.scale.length,
          octave: 0,
        }],
      })),
    };

    expect(validateMusicTrack(overcrowded)).toBe(false);
  });
});
