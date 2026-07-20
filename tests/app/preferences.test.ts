import { describe, expect, it } from 'vitest';

import {
  loadPreferences,
  saveMutedPreference,
  updateBestClear,
  type PreferencesStorage,
} from '../../src/app/preferences';

function storageWith(initial: string | null): PreferencesStorage & { value: string | null } {
  return {
    value: initial,
    getItem() {
      return this.value;
    },
    setItem(_key, value) {
      this.value = value;
    },
  };
}

describe('local game preferences', () => {
  it('falls back when persisted JSON is corrupt or unavailable', () => {
    expect(loadPreferences(storageWith('{bad json'))).toEqual({
      muted: false,
      bestClearSeconds: null,
    });

    const unavailable: PreferencesStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(loadPreferences(unavailable)).toEqual({ muted: false, bestClearSeconds: null });
  });

  it('persists mute without losing a valid best clear', () => {
    const storage = storageWith(JSON.stringify({ muted: false, bestClearSeconds: 75.25 }));

    expect(saveMutedPreference(storage, true)).toEqual({
      muted: true,
      bestClearSeconds: 75.25,
    });
    expect(loadPreferences(storage)).toEqual({ muted: true, bestClearSeconds: 75.25 });
  });

  it('keeps the fastest finite positive clear time', () => {
    const storage = storageWith(null);

    expect(updateBestClear(storage, 90).bestClearSeconds).toBe(90);
    expect(updateBestClear(storage, 110).bestClearSeconds).toBe(90);
    expect(updateBestClear(storage, 72.5).bestClearSeconds).toBe(72.5);
    expect(updateBestClear(storage, Number.NaN).bestClearSeconds).toBe(72.5);
  });

  it('normalizes malformed preference fields independently', () => {
    const storage = storageWith(JSON.stringify({ muted: 'yes', bestClearSeconds: -1 }));

    expect(loadPreferences(storage)).toEqual({ muted: false, bestClearSeconds: null });
  });
});
