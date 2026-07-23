import { describe, expect, it } from 'vitest';

import {
  defaultPreferences,
  isStageUnlocked,
  loadPreferences,
  recordAttempt,
  recordOutcome,
  saveMutedPreference,
  saveTowerTrayPositionPreference,
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

describe('local game preferences', () => {
  it('falls back when persisted JSON is corrupt or unavailable', () => {
    const corrupt = storageWith({ 'huchu-defense.preferences.v4': '{bad json' });
    expect(loadPreferences(corrupt)).toEqual(defaultPreferences());
    expect(loadPreferences(throwingStorage())).toEqual(defaultPreferences());
  });

  it('migrates v2 records to normal stage one and unlocks normal two', () => {
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
      towerTrayPosition: 'bottom',
      totalAttempts: 3,
      totalVictories: 1,
      highestUnlockedByMode: { normal: 2, nightmare: 0 },
      stageRecords: {
        'normal-1': {
          bestScore: 8200,
          bestClearScore: 8200,
          bestClearSeconds: 95,
          bestStars: 2,
          bossDefeated: true,
        },
      },
      badges: [],
    });
  });

  it('migrates v3 normal records without unlocking nightmare from stage five', () => {
    const storage = storageWith({
      'huchu-defense.preferences.v3': JSON.stringify({
        muted: true,
        totalAttempts: 9,
        totalVictories: 5,
        highestUnlockedStage: 6,
        stageRecords: {
          1: { bestScore: 8200, bestClearSeconds: 95 },
          6: { bestScore: 4000, bestClearSeconds: null },
        },
      }),
    });

    const preferences = loadPreferences(storage);
    expect(preferences.highestUnlockedByMode).toEqual({ normal: 6, nightmare: 0 });
    expect(stageRecordFor(preferences, 'normal-1')).toEqual({
      bestScore: 8200,
      bestClearScore: 8200,
      bestClearSeconds: 95,
      bestStars: 2,
      bossDefeated: true,
    });
  });

  it('unlocks nightmare one when migrated normal six has a valid clear', () => {
    const storage = storageWith({
      'huchu-defense.preferences.v3': JSON.stringify({
        highestUnlockedStage: 6,
        stageRecords: {
          6: { bestScore: 10_500, bestClearSeconds: 120 },
        },
      }),
    });

    expect(loadPreferences(storage).highestUnlockedByMode)
      .toEqual({ normal: 6, nightmare: 1 });
  });

  it('persists mute without losing mode records', () => {
    const current: GamePreferences = {
      ...defaultPreferences(),
      stageRecords: {
        'normal-1': {
          bestScore: 7000,
          bestClearScore: 7000,
          bestClearSeconds: 75.25,
          bestStars: 2,
          bossDefeated: true,
        },
      },
    };
    const storage = storageWith({});

    expect(saveMutedPreference(storage, true, current)).toEqual({
      ...current,
      muted: true,
    });
    expect(loadPreferences(storage)).toEqual({ ...current, muted: true });
  });

  it('normalizes malformed v4 fields and records independently', () => {
    const storage = storageWith({
      'huchu-defense.preferences.v4': JSON.stringify({
        muted: 'yes',
        totalAttempts: -2,
        totalVictories: Number.POSITIVE_INFINITY,
        highestUnlockedByMode: { normal: 9, nightmare: 4 },
        stageRecords: {
          'normal-1': { bestScore: -1, bestClearSeconds: Number.NaN },
          'nightmare-2': {
            bestScore: 9012.9,
            bestClearScore: 8000,
            bestClearSeconds: 81.5,
            bestStars: 9,
            bossDefeated: true,
          },
          'nightmare-9': { bestScore: 99999 },
        },
        badges: ['abyss-guardian', 'unknown', 'abyss-guardian'],
      }),
    });

    expect(loadPreferences(storage)).toEqual({
      muted: false,
      towerTrayPosition: 'bottom',
      totalAttempts: 0,
      totalVictories: 0,
      highestUnlockedByMode: { normal: 1, nightmare: 4 },
      stageRecords: {
        'normal-1': {
          bestScore: 0,
          bestClearScore: 0,
          bestClearSeconds: null,
          bestStars: 0,
          bossDefeated: false,
        },
        'nightmare-2': {
          bestScore: 9012,
          bestClearScore: 8000,
          bestClearSeconds: 81.5,
          bestStars: 3,
          bossDefeated: true,
        },
      },
      badges: ['abyss-guardian'],
    });
  });

  it('normalizes and persists the mobile tower tray position', () => {
    const storage = storageWith({
      'huchu-defense.preferences.v4': JSON.stringify({
        towerTrayPosition: 'top',
      }),
    });

    expect(defaultPreferences().towerTrayPosition).toBe('bottom');
    expect(loadPreferences(storage).towerTrayPosition).toBe('top');
    expect(loadPreferences(storageWith({
      'huchu-defense.preferences.v4': JSON.stringify({
        towerTrayPosition: 'left',
      }),
    })).towerTrayPosition).toBe('bottom');

    const saved = saveTowerTrayPositionPreference(
      storage,
      'bottom',
      loadPreferences(storage),
    );
    expect(saved.towerTrayPosition).toBe('bottom');
    expect(loadPreferences(storage).towerTrayPosition).toBe('bottom');
  });

  it('records defeat score but not clear fields or stars', () => {
    const storage = storageWith({});
    const initial = defaultPreferences();

    expect(recordAttempt(storage, initial).totalAttempts).toBe(1);
    const result = recordOutcome(storage, {
      stageKey: 'nightmare-1',
      score: 17_000,
      stars: 0,
      bossDefeated: false,
      victory: false,
      elapsedSeconds: 300,
    }, {
      ...initial,
      highestUnlockedByMode: { normal: 6, nightmare: 1 },
    });

    expect(result.preferences.highestUnlockedByMode.nightmare).toBe(1);
    expect(stageRecordFor(result.preferences, 'nightmare-1')).toEqual({
      bestScore: 17_000,
      bestClearScore: 0,
      bestClearSeconds: null,
      bestStars: 0,
      bossDefeated: false,
    });
  });

  it('unlocks nightmare one only after a normal six victory', () => {
    const result = recordOutcome(storageWith({}), {
      stageKey: 'normal-6',
      score: 11_000,
      stars: 3,
      bossDefeated: true,
      victory: true,
      elapsedSeconds: 120,
    }, {
      ...defaultPreferences(),
      highestUnlockedByMode: { normal: 6, nightmare: 0 },
    });

    expect(result.preferences.highestUnlockedByMode.nightmare).toBe(1);
    expect(result.unlockedStageKey).toBe('nightmare-1');
    expect(isStageUnlocked(result.preferences, 'nightmare-1')).toBe(true);
  });

  it('keeps the fastest clear and independent best clear score', () => {
    const current: GamePreferences = {
      ...defaultPreferences(),
      highestUnlockedByMode: { normal: 3, nightmare: 0 },
      stageRecords: {
        'normal-2': {
          bestScore: 9000,
          bestClearScore: 7500,
          bestClearSeconds: 100,
          bestStars: 2,
          bossDefeated: true,
        },
      },
    };

    const result = recordOutcome(storageWith({}), {
      stageKey: 'normal-2',
      score: 8000,
      stars: 2,
      bossDefeated: true,
      victory: true,
      elapsedSeconds: 110,
    }, current);

    expect(stageRecordFor(result.preferences, 'normal-2')).toEqual({
      bestScore: 9000,
      bestClearScore: 8000,
      bestClearSeconds: 100,
      bestStars: 2,
      bossDefeated: true,
    });
  });

  it('awards the abyss badge once and advances in memory when storage throws', () => {
    const current: GamePreferences = {
      ...defaultPreferences(),
      highestUnlockedByMode: { normal: 6, nightmare: 6 },
    };
    const result = recordOutcome(throwingStorage(), {
      stageKey: 'nightmare-6',
      score: 27_000,
      stars: 3,
      bossDefeated: true,
      victory: true,
      elapsedSeconds: 180,
    }, current);

    expect(result.preferences.badges).toEqual(['abyss-guardian']);
    expect(result.newBadge).toBe(true);
    expect(result.unlockedStageKey).toBeNull();
    expect(stageRecordFor(result.preferences, 'nightmare-6').bestClearSeconds).toBe(180);
  });
});
