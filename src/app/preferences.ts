import {
  ALL_STAGE_KEYS,
  STAGE_IDS,
} from '../game/stages/stageCatalog';
import {
  normalizeStageKey,
  normalizeStageNumber,
  stageKey,
  stageRef,
  type StageKey,
  type StageNumber,
} from '../game/stages/stageIdentity';
import type { StarRating } from '../game/scoring';

export type { StarRating } from '../game/scoring';

export type StageRecord = Readonly<{
  bestScore: number;
  bestClearScore: number;
  bestClearSeconds: number | null;
  bestStars: StarRating;
  bossDefeated: boolean;
}>;

export type GamePreferences = Readonly<{
  muted: boolean;
  totalAttempts: number;
  totalVictories: number;
  highestUnlockedByMode: Readonly<{
    normal: StageNumber;
    nightmare: 0 | StageNumber;
  }>;
  stageRecords: Partial<Record<StageKey, StageRecord>>;
  badges: readonly 'abyss-guardian'[];
}>;

export type PreferencesStorage = Pick<Storage, 'getItem' | 'setItem'>;

const PREFERENCES_KEY = 'huchu-defense.preferences.v4';
const V3_PREFERENCES_KEY = 'huchu-defense.preferences.v3';
const V2_PREFERENCES_KEY = 'huchu-defense.preferences.v2';
const V1_PREFERENCES_KEY = 'huchu-defense.preferences.v1';

const EMPTY_STAGE_RECORD: StageRecord = {
  bestScore: 0,
  bestClearScore: 0,
  bestClearSeconds: null,
  bestStars: 0,
  bossDefeated: false,
};

export function defaultPreferences(): GamePreferences {
  return {
    muted: false,
    totalAttempts: 0,
    totalVictories: 0,
    highestUnlockedByMode: { normal: 1, nightmare: 0 },
    stageRecords: {},
    badges: [],
  };
}

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

function safeStars(value: unknown): StarRating {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(3, Math.max(0, Math.floor(value))) as StarRating;
}

function safeNightmareUnlock(value: unknown): 0 | StageNumber {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 1
    && value <= 6
    ? value as StageNumber
    : 0;
}

function normalizedStageRecord(value: unknown): StageRecord {
  if (typeof value !== 'object' || value === null) return { ...EMPTY_STAGE_RECORD };
  const candidate = value as Partial<StageRecord>;
  return {
    bestScore: safeCount(candidate.bestScore),
    bestClearScore: safeCount(candidate.bestClearScore),
    bestClearSeconds: safeClearSeconds(candidate.bestClearSeconds),
    bestStars: safeStars(candidate.bestStars),
    bossDefeated: candidate.bossDefeated === true,
  };
}

function normalizedPreferences(value: unknown): GamePreferences {
  if (typeof value !== 'object' || value === null) return defaultPreferences();
  const candidate = value as Partial<GamePreferences>;
  const rawUnlocks = typeof candidate.highestUnlockedByMode === 'object'
    && candidate.highestUnlockedByMode !== null
    ? candidate.highestUnlockedByMode as Record<string, unknown>
    : {};
  const rawRecords = typeof candidate.stageRecords === 'object'
    && candidate.stageRecords !== null
    ? candidate.stageRecords as Record<string, unknown>
    : {};
  const stageRecords: Partial<Record<StageKey, StageRecord>> = {};
  for (const key of ALL_STAGE_KEYS) {
    const record = rawRecords[key];
    if (record !== undefined) stageRecords[key] = normalizedStageRecord(record);
  }
  const rawBadges = Array.isArray(candidate.badges) ? candidate.badges : [];
  const badges = rawBadges.includes('abyss-guardian')
    ? ['abyss-guardian'] as const
    : [];
  return {
    muted: candidate.muted === true,
    totalAttempts: safeCount(candidate.totalAttempts),
    totalVictories: safeCount(candidate.totalVictories),
    highestUnlockedByMode: {
      normal: normalizeStageNumber(rawUnlocks.normal),
      nightmare: safeNightmareUnlock(rawUnlocks.nightmare),
    },
    stageRecords,
    badges,
  };
}

function legacyStageRecord(value: unknown): StageRecord {
  if (typeof value !== 'object' || value === null) return { ...EMPTY_STAGE_RECORD };
  const candidate = value as Record<string, unknown>;
  const bestScore = safeCount(candidate.bestScore);
  const bestClearSeconds = safeClearSeconds(candidate.bestClearSeconds);
  const cleared = bestClearSeconds !== null;
  return {
    bestScore,
    bestClearScore: cleared ? bestScore : 0,
    bestClearSeconds,
    bestStars: cleared
      ? bestScore >= 10_000 ? 3 : bestScore >= 7_000 ? 2 : 1
      : 0,
    bossDefeated: cleared,
  };
}

function migrateV3Preferences(value: unknown): GamePreferences {
  const candidate = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
  const rawRecords = typeof candidate.stageRecords === 'object'
    && candidate.stageRecords !== null
    ? candidate.stageRecords as Record<string, unknown>
    : {};
  const stageRecords: Partial<Record<StageKey, StageRecord>> = {};
  for (const number of STAGE_IDS) {
    const record = rawRecords[String(number)];
    if (record !== undefined) stageRecords[stageKey('normal', number)] = legacyStageRecord(record);
  }
  return {
    muted: candidate.muted === true,
    totalAttempts: safeCount(candidate.totalAttempts),
    totalVictories: safeCount(candidate.totalVictories),
    highestUnlockedByMode: {
      normal: normalizeStageNumber(candidate.highestUnlockedStage),
      nightmare: stageRecords['normal-6']?.bestClearSeconds === null
        || stageRecords['normal-6'] === undefined
        ? 0
        : 1,
    },
    stageRecords,
    badges: [],
  };
}

function migrateLegacyPreferences(value: unknown): GamePreferences {
  const candidate = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
  const totalVictories = safeCount(candidate.totalVictories);
  return {
    muted: candidate.muted === true,
    totalAttempts: safeCount(candidate.totalAttempts),
    totalVictories,
    highestUnlockedByMode: {
      normal: totalVictories > 0 ? 2 : 1,
      nightmare: 0,
    },
    stageRecords: {
      'normal-1': legacyStageRecord({
        bestScore: candidate.bestScore,
        bestClearSeconds: candidate.bestClearSeconds,
      }),
    },
    badges: [],
  };
}

export function stageRecordFor(
  preferences: GamePreferences,
  value: unknown,
): StageRecord {
  return preferences.stageRecords[normalizeStageKey(value)] ?? { ...EMPTY_STAGE_RECORD };
}

export function isStageUnlocked(
  preferences: GamePreferences,
  value: unknown,
): boolean {
  const { mode, number } = stageRef(value);
  return number <= preferences.highestUnlockedByMode[mode];
}

export function loadPreferences(storage?: PreferencesStorage | null): GamePreferences {
  if (storage == null) return defaultPreferences();
  try {
    const current = storage.getItem(PREFERENCES_KEY);
    if (current !== null) return normalizedPreferences(JSON.parse(current));

    const v3 = storage.getItem(V3_PREFERENCES_KEY);
    if (v3 !== null) return migrateV3Preferences(JSON.parse(v3));

    const legacy = storage.getItem(V2_PREFERENCES_KEY) ?? storage.getItem(V1_PREFERENCES_KEY);
    return legacy === null
      ? defaultPreferences()
      : migrateLegacyPreferences(JSON.parse(legacy));
  } catch {
    return defaultPreferences();
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
    stageKey: unknown;
    score: number;
    stars: StarRating;
    bossDefeated: boolean;
    victory: boolean;
    elapsedSeconds: number;
  }>,
  current: GamePreferences = loadPreferences(storage),
): Readonly<{
  preferences: GamePreferences;
  newBestScore: boolean;
  unlockedStageKey: StageKey | null;
  newBadge: boolean;
}> {
  const ref = stageRef(result.stageKey);
  const currentRecord = stageRecordFor(current, ref.key);
  const score = safeCount(result.score);
  const validClear = result.victory
    && Number.isFinite(result.elapsedSeconds)
    && result.elapsedSeconds > 0;
  const bestClearSeconds = validClear
    ? currentRecord.bestClearSeconds === null
      ? result.elapsedSeconds
      : Math.min(currentRecord.bestClearSeconds, result.elapsedSeconds)
    : currentRecord.bestClearSeconds;
  const nextRecord: StageRecord = {
    bestScore: Math.max(currentRecord.bestScore, score),
    bestClearScore: validClear
      ? Math.max(currentRecord.bestClearScore, score)
      : currentRecord.bestClearScore,
    bestClearSeconds,
    bestStars: validClear
      ? Math.max(currentRecord.bestStars, safeStars(result.stars)) as StarRating
      : currentRecord.bestStars,
    bossDefeated: currentRecord.bossDefeated || result.bossDefeated,
  };

  let normal = current.highestUnlockedByMode.normal;
  let nightmare = current.highestUnlockedByMode.nightmare;
  let unlockedStageKey: StageKey | null = null;
  if (result.victory && ref.mode === 'normal' && ref.number < 6) {
    const next = (ref.number + 1) as StageNumber;
    if (next > normal) {
      normal = next;
      unlockedStageKey = stageKey('normal', next);
    }
  } else if (result.victory && ref.key === 'normal-6' && nightmare === 0) {
    nightmare = 1;
    unlockedStageKey = 'nightmare-1';
  } else if (result.victory && ref.mode === 'nightmare' && ref.number < 6) {
    const next = (ref.number + 1) as StageNumber;
    if (next > nightmare) {
      nightmare = next;
      unlockedStageKey = stageKey('nightmare', next);
    }
  }

  const badgeEarned = result.victory
    && ref.key === 'nightmare-6'
    && !current.badges.includes('abyss-guardian');
  const preferences = savePreferences(storage, {
    ...current,
    totalVictories: current.totalVictories + (result.victory ? 1 : 0),
    highestUnlockedByMode: { normal, nightmare },
    stageRecords: {
      ...current.stageRecords,
      [ref.key]: nextRecord,
    },
    badges: badgeEarned ? [...current.badges, 'abyss-guardian'] : current.badges,
  });
  return {
    preferences,
    newBestScore: score > currentRecord.bestScore,
    unlockedStageKey,
    newBadge: badgeEarned,
  };
}

export function browserPreferenceStorage(): PreferencesStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
