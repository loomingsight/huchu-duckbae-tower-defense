import { createStageMap, type StageMap } from '../map/createStageMap';
import { STAGE_1_WAVES, type Wave } from '../waves/stage1Waves';
import {
  STAGE_2_WAVES,
  STAGE_3_WAVES,
  STAGE_4_WAVES,
  STAGE_5_WAVES,
  STAGE_6_WAVES,
} from '../waves/stageWaves';

export const STAGE_IDS = [1, 2, 3, 4, 5, 6] as const;
export type StageId = (typeof STAGE_IDS)[number];

export type StageDefinition = Readonly<{
  id: StageId;
  name: string;
  map: StageMap;
  waves: readonly Wave[];
  hpMultiplier: number;
  speedMultiplier: number;
  spawnIntervalMultiplier: number;
}>;

export const STAGE_CATALOG: readonly StageDefinition[] = [
  {
    id: 1,
    name: '초록 들판',
    map: createStageMap([
      { col: 0, row: 2 },
      { col: 5, row: 2 },
      { col: 5, row: 7 },
      { col: 12, row: 7 },
      { col: 12, row: 3 },
      { col: 19, row: 3 },
    ]),
    waves: STAGE_1_WAVES,
    hpMultiplier: 1,
    speedMultiplier: 1,
    spawnIntervalMultiplier: 1,
  },
  {
    id: 2,
    name: '굽이 개울',
    map: createStageMap([
      { col: 0, row: 7 },
      { col: 6, row: 7 },
      { col: 6, row: 3 },
      { col: 13, row: 3 },
      { col: 13, row: 7 },
      { col: 19, row: 7 },
    ]),
    waves: STAGE_2_WAVES,
    hpMultiplier: 1.08,
    speedMultiplier: 1,
    spawnIntervalMultiplier: 1,
  },
  {
    id: 3,
    name: '바람 언덕',
    map: createStageMap([
      { col: 0, row: 1 },
      { col: 7, row: 1 },
      { col: 7, row: 5 },
      { col: 13, row: 5 },
      { col: 13, row: 2 },
      { col: 19, row: 2 },
    ]),
    waves: STAGE_3_WAVES,
    hpMultiplier: 1.16,
    speedMultiplier: 1.02,
    spawnIntervalMultiplier: 0.98,
  },
  {
    id: 4,
    name: '오크 협곡',
    map: createStageMap([
      { col: 0, row: 8 },
      { col: 5, row: 8 },
      { col: 5, row: 5 },
      { col: 11, row: 5 },
      { col: 11, row: 2 },
      { col: 19, row: 2 },
    ]),
    waves: STAGE_4_WAVES,
    hpMultiplier: 1.26,
    speedMultiplier: 1.04,
    spawnIntervalMultiplier: 0.96,
  },
  {
    id: 5,
    name: '골렘 채석장',
    map: createStageMap([
      { col: 0, row: 2 },
      { col: 9, row: 2 },
      { col: 9, row: 6 },
      { col: 19, row: 6 },
    ]),
    waves: STAGE_5_WAVES,
    hpMultiplier: 1.38,
    speedMultiplier: 1.06,
    spawnIntervalMultiplier: 0.94,
  },
  {
    id: 6,
    name: '미노타우르스 관문',
    map: createStageMap([
      { col: 0, row: 1 },
      { col: 5, row: 1 },
      { col: 5, row: 3 },
      { col: 15, row: 3 },
      { col: 15, row: 2 },
      { col: 19, row: 2 },
    ]),
    waves: STAGE_6_WAVES,
    hpMultiplier: 1.52,
    speedMultiplier: 1.08,
    spawnIntervalMultiplier: 0.92,
  },
];

export function normalizeStageId(value: unknown): StageId {
  return typeof value === 'number'
    && Number.isInteger(value)
    && (STAGE_IDS as readonly number[]).includes(value)
    ? value as StageId
    : 1;
}

export function getStageDefinition(value: unknown): StageDefinition {
  return STAGE_CATALOG[normalizeStageId(value) - 1];
}
