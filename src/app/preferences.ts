export type GamePreferences = Readonly<{
  muted: boolean;
  bestClearSeconds: number | null;
}>;

export type PreferencesStorage = Pick<Storage, 'getItem' | 'setItem'>;

const PREFERENCES_KEY = 'huchu-defense.preferences.v1';
const DEFAULT_PREFERENCES: GamePreferences = {
  muted: false,
  bestClearSeconds: null,
};

function normalizedPreferences(value: unknown): GamePreferences {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_PREFERENCES };
  const candidate = value as Partial<GamePreferences>;
  return {
    muted: typeof candidate.muted === 'boolean' ? candidate.muted : false,
    bestClearSeconds: typeof candidate.bestClearSeconds === 'number'
      && Number.isFinite(candidate.bestClearSeconds)
      && candidate.bestClearSeconds > 0
      ? candidate.bestClearSeconds
      : null,
  };
}

export function loadPreferences(storage?: PreferencesStorage | null): GamePreferences {
  if (storage == null) return { ...DEFAULT_PREFERENCES };
  try {
    const raw = storage.getItem(PREFERENCES_KEY);
    return raw === null ? { ...DEFAULT_PREFERENCES } : normalizedPreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(
  storage: PreferencesStorage | null | undefined,
  preferences: GamePreferences,
): GamePreferences {
  const normalized = normalizedPreferences(preferences);
  try {
    storage?.setItem(PREFERENCES_KEY, JSON.stringify(normalized));
  } catch {
    // Preferences are best-effort; privacy modes and full storage must not break play.
  }
  return normalized;
}

export function saveMutedPreference(
  storage: PreferencesStorage | null | undefined,
  muted: boolean,
): GamePreferences {
  const current = loadPreferences(storage);
  return savePreferences(storage, { ...current, muted });
}

export function updateBestClear(
  storage: PreferencesStorage | null | undefined,
  clearSeconds: number,
): GamePreferences {
  const current = loadPreferences(storage);
  if (!Number.isFinite(clearSeconds) || clearSeconds <= 0) return current;
  const bestClearSeconds = current.bestClearSeconds === null
    ? clearSeconds
    : Math.min(current.bestClearSeconds, clearSeconds);
  return savePreferences(storage, { ...current, bestClearSeconds });
}

export function browserPreferenceStorage(): PreferencesStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
