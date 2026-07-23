import { createStageMap, type StageMap } from '../map/createStageMap';
import { createNightmareWaves } from '../waves/nightmareWaves';
import { STAGE_1_WAVES, type Wave } from '../waves/stage1Waves';
import {
  STAGE_2_WAVES,
  STAGE_3_WAVES,
  STAGE_4_WAVES,
  STAGE_5_WAVES,
  STAGE_6_WAVES,
} from '../waves/stageWaves';
import {
  NIGHTMARE_THEME_IDS,
  normalizeStageKey,
  normalizeStageNumber,
  stageKey,
  STAGE_NUMBERS,
  type GameMode,
  type StageKey,
  type StageNumber,
  type StageThemeId,
} from './stageIdentity';

export const STAGE_IDS = STAGE_NUMBERS;
export type StageId = StageNumber;

export const NORMAL_STAGE_KEYS: readonly StageKey[] = STAGE_NUMBERS.map(
  (number) => stageKey('normal', number),
);
export const NIGHTMARE_STAGE_KEYS: readonly StageKey[] = STAGE_NUMBERS.map(
  (number) => stageKey('nightmare', number),
);
export const ALL_STAGE_KEYS: readonly StageKey[] = [
  ...NORMAL_STAGE_KEYS,
  ...NIGHTMARE_STAGE_KEYS,
];

export type StageDefinition = Readonly<{
  key: StageKey;
  mode: GameMode;
  number: StageNumber;
  name: string;
  themeId: StageThemeId;
  map: StageMap;
  waves: readonly Wave[];
  hpMultiplier: number;
  speedMultiplier: number;
  spawnIntervalMultiplier: number;
  countMultiplier: number;
  startingGold: number;
  baseHp: number;
  rewardMultiplier: number;
  scoreMultiplier: number;
  twoStarScore: number;
  threeStarScore: number;
}>;

type NormalStageSeed = Readonly<{
  name: string;
  waypoints: Parameters<typeof createStageMap>[0];
  waves: readonly Wave[];
  hpMultiplier: number;
  speedMultiplier: number;
  spawnIntervalMultiplier: number;
}>;

const NORMAL_STAGE_SEEDS: readonly NormalStageSeed[] = [
  {
    name: '초록 들판',
    waypoints: [
      { col: 0, row: 2 },
      { col: 5, row: 2 },
      { col: 5, row: 7 },
      { col: 12, row: 7 },
      { col: 12, row: 3 },
      { col: 19, row: 3 },
    ],
    waves: STAGE_1_WAVES,
    hpMultiplier: 1,
    speedMultiplier: 1,
    spawnIntervalMultiplier: 1,
  },
  {
    name: '굽이 개울',
    waypoints: [
      { col: 0, row: 7 },
      { col: 6, row: 7 },
      { col: 6, row: 3 },
      { col: 13, row: 3 },
      { col: 13, row: 7 },
      { col: 19, row: 7 },
    ],
    waves: STAGE_2_WAVES,
    hpMultiplier: 1.08,
    speedMultiplier: 1,
    spawnIntervalMultiplier: 1,
  },
  {
    name: '바람 언덕',
    waypoints: [
      { col: 0, row: 1 },
      { col: 7, row: 1 },
      { col: 7, row: 5 },
      { col: 13, row: 5 },
      { col: 13, row: 2 },
      { col: 19, row: 2 },
    ],
    waves: STAGE_3_WAVES,
    hpMultiplier: 1.16,
    speedMultiplier: 1.02,
    spawnIntervalMultiplier: 0.98,
  },
  {
    name: '오크 협곡',
    waypoints: [
      { col: 0, row: 8 },
      { col: 5, row: 8 },
      { col: 5, row: 5 },
      { col: 11, row: 5 },
      { col: 11, row: 2 },
      { col: 19, row: 2 },
    ],
    waves: STAGE_4_WAVES,
    hpMultiplier: 1.26,
    speedMultiplier: 1.04,
    spawnIntervalMultiplier: 0.96,
  },
  {
    name: '골렘 채석장',
    waypoints: [
      { col: 0, row: 2 },
      { col: 9, row: 2 },
      { col: 9, row: 6 },
      { col: 19, row: 6 },
    ],
    waves: STAGE_5_WAVES,
    hpMultiplier: 1.38,
    speedMultiplier: 1.06,
    spawnIntervalMultiplier: 0.94,
  },
  {
    name: '미노타우르스 관문',
    waypoints: [
      { col: 0, row: 1 },
      { col: 5, row: 1 },
      { col: 5, row: 3 },
      { col: 15, row: 3 },
      { col: 15, row: 2 },
      { col: 19, row: 2 },
    ],
    waves: STAGE_6_WAVES,
    hpMultiplier: 1.52,
    speedMultiplier: 1.08,
    spawnIntervalMultiplier: 0.92,
  },
];

const NIGHTMARE_NAMES = [
  '달빛 늪',
  '썩은 숲',
  '잿빛 폐허',
  '핏빛 협곡',
  '흑요석 광산',
  '심연의 성문',
] as const;

const NIGHTMARE_ROUTES = [
  [[0, 7], [4, 7], [4, 2], [10, 2], [10, 6], [15, 6], [15, 4], [19, 4]],
  [[0, 2], [6, 2], [6, 7], [12, 7], [12, 4], [19, 4]],
  [[0, 8], [5, 8], [5, 4], [14, 4], [14, 2], [19, 2]],
  [[0, 3], [7, 3], [7, 7], [13, 7], [13, 4], [19, 4]],
  [[0, 6], [5, 6], [5, 3], [15, 3], [15, 5], [19, 5]],
  [[0, 4], [8, 4], [8, 6], [13, 6], [13, 4], [19, 4]],
] as const;

const NIGHTMARE_HP_MULTIPLIERS = [1, 1.10, 1.21, 1.33, 1.47, 1.62] as const;
const NIGHTMARE_SPEED_MULTIPLIERS = [1, 1.02, 1.04, 1.06, 1.08, 1.10] as const;
const NIGHTMARE_SPAWN_MULTIPLIERS = [1, 0.97, 0.94, 0.91, 0.88, 0.85] as const;
const NIGHTMARE_COUNT_MULTIPLIERS = [1, 1.04, 1.08, 1.12, 1.16, 1.20] as const;
const NIGHTMARE_TWO_STAR_SCORES = [18_500, 19_000, 19_500, 20_500, 20_500, 21_500] as const;
const NIGHTMARE_THREE_STAR_SCORES = [23_000, 23_500, 24_000, 25_000, 25_000, 26_500] as const;

const NORMAL_STAGES: readonly StageDefinition[] = STAGE_NUMBERS.map((number) => {
  const seed = NORMAL_STAGE_SEEDS[number - 1];
  return {
    key: stageKey('normal', number),
    mode: 'normal',
    number,
    name: seed.name,
    themeId: 'normal',
    map: createStageMap(seed.waypoints),
    waves: seed.waves,
    hpMultiplier: seed.hpMultiplier,
    speedMultiplier: seed.speedMultiplier,
    spawnIntervalMultiplier: seed.spawnIntervalMultiplier,
    countMultiplier: 1,
    startingGold: 320,
    baseHp: 20,
    rewardMultiplier: 1,
    scoreMultiplier: 1,
    twoStarScore: 7_000,
    threeStarScore: 10_000,
  };
});

const NIGHTMARE_STAGES: readonly StageDefinition[] = STAGE_NUMBERS.map((number) => {
  const index = number - 1;
  const waypoints = NIGHTMARE_ROUTES[index].map(([col, row]) => ({ col, row }));
  return {
    key: stageKey('nightmare', number),
    mode: 'nightmare',
    number,
    name: NIGHTMARE_NAMES[index],
    themeId: NIGHTMARE_THEME_IDS[index],
    map: createStageMap(waypoints),
    waves: createNightmareWaves(number),
    hpMultiplier: NIGHTMARE_HP_MULTIPLIERS[index],
    speedMultiplier: NIGHTMARE_SPEED_MULTIPLIERS[index],
    spawnIntervalMultiplier: NIGHTMARE_SPAWN_MULTIPLIERS[index],
    countMultiplier: NIGHTMARE_COUNT_MULTIPLIERS[index],
    startingGold: 280,
    baseHp: 12,
    rewardMultiplier: 0.85,
    scoreMultiplier: 1.5,
    twoStarScore: NIGHTMARE_TWO_STAR_SCORES[index],
    threeStarScore: NIGHTMARE_THREE_STAR_SCORES[index],
  };
});

export const STAGE_CATALOG: readonly StageDefinition[] = [
  ...NORMAL_STAGES,
  ...NIGHTMARE_STAGES,
];

const STAGES_BY_KEY = new Map(STAGE_CATALOG.map((stage) => [stage.key, stage] as const));

export function normalizeStageId(value: unknown): StageId {
  return normalizeStageNumber(value);
}

export function getStageDefinition(value: unknown): StageDefinition {
  return STAGES_BY_KEY.get(normalizeStageKey(value)) ?? NORMAL_STAGES[0];
}
