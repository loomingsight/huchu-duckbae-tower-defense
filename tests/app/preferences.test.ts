import { describe, expect, it } from 'vitest';

import {
  loadPreferences,
  recordAttempt,
  recordOutcome,
  saveMutedPreference,
  stageRecordFor,
  type GamePreferences,
  type PreferencesStorage,
} from '../../src/app/preferences';

function storageWith(initial: Readonly<Record<string, string>>): PreferencesStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

function throwingStorage(): PreferencesStorage {
  return {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  };
}

function defaultPreferences(): GamePreferences {
  return {
    muted: false,
    totalAttempts: 0,
    totalVictories: 0,
    highestUnlockedStage: 1,
    stageRecords: {},
  };
}

describe('local game preferences', () => {
  it('falls back when persisted JSON is corrupt or unavailable', () => {
    const corrupt = storageWith({ 'huchu-defense.preferences.v3': '{bad json' });
    expect(loadPreferences(corrupt)).toEqual(defaultPreferences());
    expect(loadPreferences(throwingStorage())).toEqual(defaultPreferences());
  });

  it('migrates v2 records to stage one and unlocks stage two after a prior victory', () => {
    const storage = storageWith({
      'huchu-defense.preferences.v2': JSON.stringify({
        muted: true,
        bestScore: 8200,
        bestClearSeconds: 95,
        totalAttempts: 3,
        totalVictories: 1,
      }),
    });

    expect(loadPreferences(storage)).toEqual({
      muted: true,
      totalAttempts: 3,
      totalVictories: 1,
      highestUnlockedStage: 2,
      stageRecords: { 1: { bestScore: 8200, bestClearSeconds: 95 } },
    });
  });

  it('persists mute without losing stage records', () => {
    const current: GamePreferences = {
      ...defaultPreferences(),
      stageRecords: { 1: { bestScore: 7000, bestClearSeconds: 75.25 } },
    };
    const storage = storageWith({});

    expect(saveMutedPreference(storage, true, current)).toEqual({
      ...current,
      muted: true,
    });
    expect(loadPreferences(storage)).toEqual({ ...current, muted: true });
  });

  it('normalizes malformed v3 fields and records independently', () => {
    const storage = storageWith({
      'huchu-defense.preferences.v3': JSON.stringify({
        muted: 'yes',
        totalAttempts: -2,
        totalVictories: Number.POSITIVE_INFINITY,
        highestUnlockedStage: 9,
        stageRecords: {
          1: { bestScore: -1, bestClearSeconds: Number.NaN },
          2: { bestScore: 9012.9, bestClearSeconds: 81.5 },
          9: { bestScore: 99999, bestClearSeconds: 1 },
        },
      }),
    });

    expect(loadPreferences(storage)).toEqual({
      muted: false,
      totalAttempts: 0,
      totalVictories: 0,
      highestUnlockedStage: 1,
      stageRecords: {
        1: { bestScore: 0, bestClearSeconds: null },
        2: { bestScore: 9012, bestClearSeconds: 81.5 },
      },
    });
  });

  it('unlocks only the next stage on victory and keeps defeat locked', () => {
    const storage = storageWith({});
    const initial = loadPreferences(storage);

    expect(recordAttempt(storage, initial).totalAttempts).toBe(1);
    const defeat = recordOutcome(storage, {
      stageId: 1,
      score: 4000,
      victory: false,
      elapsedSeconds: 90,
    }, initial);
    expect(defeat.preferences.highestUnlockedStage).toBe(1);
    expect(stageRecordFor(defeat.preferences, 1)).toEqual({
      bestScore: 4000,
      bestClearSeconds: null,
    });

    const victory = recordOutcome(storage, {
      stageId: 1,
      score: 8000,
      victory: true,
      elapsedSeconds: 85,
    }, defeat.preferences);
    expect(victory.newBestScore).toBe(true);
    expect(victory.preferences.highestUnlockedStage).toBe(2);
    expect(victory.preferences.totalVictories).toBe(1);
    expect(stageRecordFor(victory.preferences, 1)).toEqual({
      bestScore: 8000,
      bestClearSeconds: 85,
    });
  });

  it('updates only the current stage record and keeps its fastest valid clear', () => {
    const storage = storageWith({});
    const current: GamePreferences = {
      ...defaultPreferences(),
      highestUnlockedStage: 3,
      stageRecords: {
        1: { bestScore: 9000, bestClearSeconds: 70 },
        2: { bestScore: 6000, bestClearSeconds: 100 },
      },
    };

    const result = recordOutcome(storage, {
      stageId: 2,
      score: 7500,
      victory: true,
      elapsedSeconds: 110,
    }, current);

    expect(stageRecordFor(result.preferences, 1)).toEqual(current.stageRecords[1]);
    expect(stageRecordFor(result.preferences, 2)).toEqual({
      bestScore: 7500,
      bestClearSeconds: 100,
    });
  });

  it('caps unlocks at six and advances in memory when storage throws', () => {
    const current: GamePreferences = { ...defaultPreferences(), highestUnlockedStage: 6 };
    const result = recordOutcome(throwingStorage(), {
      stageId: 6,
      score: 11000,
      victory: true,
      elapsedSeconds: 120,
    }, current);

    expect(result.preferences.highestUnlockedStage).toBe(6);
    expect(stageRecordFor(result.preferences, 6)).toEqual({
      bestScore: 11000,
      bestClearSeconds: 120,
    });
  });
});
