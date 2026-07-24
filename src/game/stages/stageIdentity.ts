export const GAME_MODES = ['normal', 'nightmare'] as const;

export type GameMode = (typeof GAME_MODES)[number];

export const STAGE_NUMBERS = [1, 2, 3, 4, 5, 6] as const;

export type StageNumber = (typeof STAGE_NUMBERS)[number];
export type StageKey = `${GameMode}-${StageNumber}`;

export const DEFAULT_STAGE_KEY: StageKey = 'normal-1';

export const NORMAL_THEME_IDS = [
  'sunnyField',
  'windingStream',
  'windyHill',
  'orcCanyon',
  'golemQuarry',
  'minotaurGate',
] as const;

export const NIGHTMARE_THEME_IDS = [
  'moonlitSwamp',
  'rottenForest',
  'ashenRuins',
  'bloodRavine',
  'obsidianMine',
  'abyssGate',
] as const;

export const STAGE_THEME_IDS = [...NORMAL_THEME_IDS, ...NIGHTMARE_THEME_IDS] as const;

export type StageThemeId = (typeof STAGE_THEME_IDS)[number];

export function stageKey(mode: GameMode, number: StageNumber): StageKey {
  return `${mode}-${number}`;
}

export function normalizeStageNumber(value: unknown): StageNumber {
  return typeof value === 'number'
    && Number.isInteger(value)
    && (STAGE_NUMBERS as readonly number[]).includes(value)
    ? value as StageNumber
    : 1;
}

export function normalizeStageKey(value: unknown): StageKey {
  if (typeof value === 'number') return stageKey('normal', normalizeStageNumber(value));
  if (typeof value !== 'string') return DEFAULT_STAGE_KEY;
  const match = /^(normal|nightmare)-([1-6])$/.exec(value);
  return match === null
    ? DEFAULT_STAGE_KEY
    : stageKey(match[1] as GameMode, Number(match[2]) as StageNumber);
}

export function stageRef(value: unknown): Readonly<{
  key: StageKey;
  mode: GameMode;
  number: StageNumber;
}> {
  const key = normalizeStageKey(value);
  const [mode, number] = key.split('-');
  return {
    key,
    mode: mode as GameMode,
    number: Number(number) as StageNumber,
  };
}
