export type GamePreferences = Readonly<{
  muted: boolean;
  bestClearSeconds: number | null;
  bestScore: number;
  totalAttempts: number;
  totalVictories: number;
}>;

export type PreferencesStorage = Pick<Storage, 'getItem' | 'setItem'>;

const PREFERENCES_KEY = 'huchu-defense.preferences.v2';
const LEGACY_PREFERENCES_KEY = 'huchu-defense.preferences.v1';
const DEFAULT_PREFERENCES: GamePreferences = {
  muted: false,
  bestClearSeconds: null,
  bestScore: 0,
  totalAttempts: 0,
  totalVictories: 0,
};

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

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
    bestScore: safeCount(candidate.bestScore),
    totalAttempts: safeCount(candidate.totalAttempts),
    totalVictories: safeCount(candidate.totalVictories),
  };
}

export function loadPreferences(storage?: PreferencesStorage | null): GamePreferences {
  if (storage == null) return { ...DEFAULT_PREFERENCES };
  try {
    const raw = storage.getItem(PREFERENCES_KEY) ?? storage.getItem(LEGACY_PREFERENCES_KEY);
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

export function recordAttempt(
  storage: PreferencesStorage | null | undefined,
): GamePreferences {
  const current = loadPreferences(storage);
  return savePreferences(storage, {
    ...current,
    totalAttempts: current.totalAttempts + 1,
  });
}

export function recordOutcome(
  storage: PreferencesStorage | null | undefined,
  result: Readonly<{
    score: number;
    victory: boolean;
    elapsedSeconds: number;
  }>,
): Readonly<{ preferences: GamePreferences; newBestScore: boolean }> {
  const current = loadPreferences(storage);
  const score = safeCount(result.score);
  const validClear = result.victory
    && Number.isFinite(result.elapsedSeconds)
    && result.elapsedSeconds > 0;
  const bestClearSeconds = validClear
    ? current.bestClearSeconds === null
      ? result.elapsedSeconds
      : Math.min(current.bestClearSeconds, result.elapsedSeconds)
    : current.bestClearSeconds;
  const newBestScore = score > current.bestScore;
  const preferences = savePreferences(storage, {
    ...current,
    bestScore: Math.max(current.bestScore, score),
    bestClearSeconds,
    totalVictories: current.totalVictories + (result.victory ? 1 : 0),
  });
  return { preferences, newBestScore };
}

export function browserPreferenceStorage(): PreferencesStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
