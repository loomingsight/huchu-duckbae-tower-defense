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
  NORMAL_THEME_IDS,
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
  waveHpGrowth: number;
  interWaveDelaySeconds: number;
  targetClearSeconds: Readonly<{
    min: number;
    max: number;
  }>;
}>;

type NormalStageSeed = Readonly<{
  name: string;
  themeId: StageThemeId;
  waypoints: Parameters<typeof createStageMap>[0];
  waves: readonly Wave[];
  hpMultiplier: number;
  speedMultiplier: number;
  spawnIntervalMultiplier: number;
}>;

const NORMAL_STAGE_SEEDS: readonly NormalStageSeed[] = [
  {
    name: '초록 들판',
    themeId: NORMAL_THEME_IDS[0],
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
    themeId: NORMAL_THEME_IDS[1],
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
    themeId: NORMAL_THEME_IDS[2],
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
    themeId: NORMAL_THEME_IDS[3],
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
    themeId: NORMAL_THEME_IDS[4],
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
    themeId: NORMAL_THEME_IDS[5],
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

const DEFAULT_WAVE_HP_GROWTH = 0.08;
const DEFAULT_INTER_WAVE_DELAY_SECONDS = 5;
const DEFAULT_TARGET_CLEAR_SECONDS = Object.freeze({ min: 300, max: 420 });

const NIGHTMARE_DIFFICULTY = [
  {
    hpMultiplier: 1,
    speedMultiplier: 1,
    spawnIntervalMultiplier: 1,
    countMultiplier: 1,
    startingGold: 280,
    twoStarScore: 18_500,
    threeStarScore: 23_000,
  },
  {
    hpMultiplier: 1.04,
    speedMultiplier: 1,
    spawnIntervalMultiplier: 1,
    countMultiplier: 1,
    startingGold: 280,
    twoStarScore: 18_500,
    threeStarScore: 23_000,
  },
  {
    hpMultiplier: 1.07,
    speedMultiplier: 1.01,
    spawnIntervalMultiplier: 1,
    countMultiplier: 1,
    startingGold: 360,
    twoStarScore: 19_000,
    threeStarScore: 23_500,
  },
  {
    hpMultiplier: 1.13,
    speedMultiplier: 1.02,
    spawnIntervalMultiplier: 0.98,
    countMultiplier: 1.02,
    startingGold: 380,
    twoStarScore: 19_500,
    threeStarScore: 24_000,
  },
  {
    hpMultiplier: 1.21,
    speedMultiplier: 1.03,
    spawnIntervalMultiplier: 0.96,
    countMultiplier: 1.05,
    startingGold: 480,
    twoStarScore: 19_500,
    threeStarScore: 24_000,
  },
  {
    hpMultiplier: 1.30,
    speedMultiplier: 1.05,
    spawnIntervalMultiplier: 0.94,
    countMultiplier: 1.08,
    startingGold: 480,
    twoStarScore: 20_500,
    threeStarScore: 25_000,
  },
] as const;

const NORMAL_STAGES: readonly StageDefinition[] = STAGE_NUMBERS.map((number) => {
  const seed = NORMAL_STAGE_SEEDS[number - 1];
  return {
    key: stageKey('normal', number),
    mode: 'normal',
    number,
    name: seed.name,
    themeId: seed.themeId,
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
    waveHpGrowth: DEFAULT_WAVE_HP_GROWTH,
    interWaveDelaySeconds: DEFAULT_INTER_WAVE_DELAY_SECONDS,
    targetClearSeconds: DEFAULT_TARGET_CLEAR_SECONDS,
  };
});

const NIGHTMARE_STAGES: readonly StageDefinition[] = STAGE_NUMBERS.map((number) => {
  const index = number - 1;
  const difficulty = NIGHTMARE_DIFFICULTY[index];
  const waypoints = NIGHTMARE_ROUTES[index].map(([col, row]) => ({ col, row }));
  return {
    key: stageKey('nightmare', number),
    mode: 'nightmare',
    number,
    name: NIGHTMARE_NAMES[index],
    themeId: NIGHTMARE_THEME_IDS[index],
    map: createStageMap(waypoints),
    waves: createNightmareWaves(number, difficulty.countMultiplier),
    hpMultiplier: difficulty.hpMultiplier,
    speedMultiplier: difficulty.speedMultiplier,
    spawnIntervalMultiplier: difficulty.spawnIntervalMultiplier,
    countMultiplier: difficulty.countMultiplier,
    startingGold: difficulty.startingGold,
    baseHp: 12,
    rewardMultiplier: 0.85,
    scoreMultiplier: 1.5,
    twoStarScore: difficulty.twoStarScore,
    threeStarScore: difficulty.threeStarScore,
    waveHpGrowth: DEFAULT_WAVE_HP_GROWTH,
    interWaveDelaySeconds: DEFAULT_INTER_WAVE_DELAY_SECONDS,
    targetClearSeconds: DEFAULT_TARGET_CLEAR_SECONDS,
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
