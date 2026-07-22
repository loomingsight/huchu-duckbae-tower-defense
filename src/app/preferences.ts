import {
  normalizeStageId,
  STAGE_IDS,
  type StageId,
} from '../game/stages/stageCatalog';

export type StageRecord = Readonly<{
  bestScore: number;
  bestClearSeconds: number | null;
}>;

export type GamePreferences = Readonly<{
  muted: boolean;
  totalAttempts: number;
  totalVictories: number;
  highestUnlockedStage: StageId;
  stageRecords: Partial<Record<StageId, StageRecord>>;
}>;

export type PreferencesStorage = Pick<Storage, 'getItem' | 'setItem'>;

const PREFERENCES_KEY = 'huchu-defense.preferences.v3';
const V2_PREFERENCES_KEY = 'huchu-defense.preferences.v2';
const V1_PREFERENCES_KEY = 'huchu-defense.preferences.v1';
const EMPTY_STAGE_RECORD: StageRecord = { bestScore: 0, bestClearSeconds: null };
const DEFAULT_PREFERENCES: GamePreferences = {
  muted: false,
  totalAttempts: 0,
  totalVictories: 0,
  highestUnlockedStage: 1,
  stageRecords: {},
};

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function safeClearSeconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function normalizedStageRecord(value: unknown): StageRecord {
  if (typeof value !== 'object' || value === null) return { ...EMPTY_STAGE_RECORD };
  const candidate = value as Partial<StageRecord>;
  return {
    bestScore: safeCount(candidate.bestScore),
    bestClearSeconds: safeClearSeconds(candidate.bestClearSeconds),
  };
}

function normalizedPreferences(value: unknown): GamePreferences {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_PREFERENCES };
  const candidate = value as Partial<GamePreferences>;
  const rawRecords = typeof candidate.stageRecords === 'object' && candidate.stageRecords !== null
    ? candidate.stageRecords as Record<string, unknown>
    : {};
  const stageRecords: Partial<Record<StageId, StageRecord>> = {};
  for (const stageId of STAGE_IDS) {
    const record = rawRecords[String(stageId)];
    if (record !== undefined) stageRecords[stageId] = normalizedStageRecord(record);
  }
  return {
    muted: typeof candidate.muted === 'boolean' ? candidate.muted : false,
    totalAttempts: safeCount(candidate.totalAttempts),
    totalVictories: safeCount(candidate.totalVictories),
    highestUnlockedStage: normalizeStageId(candidate.highestUnlockedStage),
    stageRecords,
  };
}

function migrateLegacyPreferences(value: unknown): GamePreferences {
  const candidate = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
  const totalVictories = safeCount(candidate.totalVictories);
  return {
    muted: typeof candidate.muted === 'boolean' ? candidate.muted : false,
    totalAttempts: safeCount(candidate.totalAttempts),
    totalVictories,
    highestUnlockedStage: totalVictories > 0 ? 2 : 1,
    stageRecords: {
      1: normalizedStageRecord({
        bestScore: candidate.bestScore,
        bestClearSeconds: candidate.bestClearSeconds,
      }),
    },
  };
}

export function stageRecordFor(
  preferences: GamePreferences,
  stageId: unknown,
): StageRecord {
  const id = normalizeStageId(stageId);
  return preferences.stageRecords[id] ?? { ...EMPTY_STAGE_RECORD };
}

export function loadPreferences(storage?: PreferencesStorage | null): GamePreferences {
  if (storage == null) return { ...DEFAULT_PREFERENCES };
  try {
    const current = storage.getItem(PREFERENCES_KEY);
    if (current !== null) return normalizedPreferences(JSON.parse(current));

    const legacy = storage.getItem(V2_PREFERENCES_KEY) ?? storage.getItem(V1_PREFERENCES_KEY);
    return legacy === null
      ? { ...DEFAULT_PREFERENCES }
      : migrateLegacyPreferences(JSON.parse(legacy));
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
  current: GamePreferences = loadPreferences(storage),
): GamePreferences {
  return savePreferences(storage, { ...current, muted });
}

export function recordAttempt(
  storage: PreferencesStorage | null | undefined,
  current: GamePreferences = loadPreferences(storage),
): GamePreferences {
  return savePreferences(storage, {
    ...current,
    totalAttempts: current.totalAttempts + 1,
  });
}

export function recordOutcome(
  storage: PreferencesStorage | null | undefined,
  result: Readonly<{
    stageId: unknown;
    score: number;
    victory: boolean;
    elapsedSeconds: number;
  }>,
  current: GamePreferences = loadPreferences(storage),
): Readonly<{ preferences: GamePreferences; newBestScore: boolean }> {
  const stageId = normalizeStageId(result.stageId);
  const currentRecord = stageRecordFor(current, stageId);
  const score = safeCount(result.score);
  const validClear = result.victory
    && Number.isFinite(result.elapsedSeconds)
    && result.elapsedSeconds > 0;
  const bestClearSeconds = validClear
    ? currentRecord.bestClearSeconds === null
      ? result.elapsedSeconds
      : Math.min(currentRecord.bestClearSeconds, result.elapsedSeconds)
    : currentRecord.bestClearSeconds;
  const newBestScore = score > currentRecord.bestScore;
  const highestUnlockedStage = result.victory
    ? Math.min(6, Math.max(current.highestUnlockedStage, stageId + 1)) as StageId
    : current.highestUnlockedStage;
  const preferences = savePreferences(storage, {
    ...current,
    totalVictories: current.totalVictories + (result.victory ? 1 : 0),
    highestUnlockedStage,
    stageRecords: {
      ...current.stageRecords,
      [stageId]: {
        bestScore: Math.max(currentRecord.bestScore, score),
        bestClearSeconds,
      },
    },
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
