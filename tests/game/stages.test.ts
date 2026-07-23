import { describe, expect, it } from 'vitest';

import { ENEMY_CATALOG } from '../../src/game/enemies/enemyCatalog';
import { createStageMap } from '../../src/game/map/createStageMap';
import {
  ALL_STAGE_KEYS,
  getStageDefinition,
  NIGHTMARE_STAGE_KEYS,
  normalizeStageId,
  STAGE_CATALOG,
  STAGE_IDS,
} from '../../src/game/stages/stageCatalog';
import {
  normalizeStageKey,
  stageRef,
} from '../../src/game/stages/stageIdentity';

const EXPECTED = [
  {
    id: 1,
    name: '초록 들판',
    steps: 28,
    buildable: 58,
    hp: 1,
    speed: 1,
    spawn: 1,
    counts: [40, 46, 64, 24, 1],
    reward: 2_562,
  },
  {
    id: 2,
    name: '굽이 개울',
    steps: 27,
    buildable: 56,
    hp: 1.08,
    speed: 1,
    spawn: 1,
    counts: [30, 66, 62, 22, 1],
    reward: 2_596,
  },
  {
    id: 3,
    name: '바람 언덕',
    steps: 26,
    buildable: 54,
    hp: 1.16,
    speed: 1.02,
    spawn: 0.98,
    counts: [24, 49, 80, 22, 1],
    reward: 2_648,
  },
  {
    id: 4,
    name: '오크 협곡',
    steps: 25,
    buildable: 52,
    hp: 1.26,
    speed: 1.04,
    spawn: 0.96,
    counts: [20, 33, 72, 35, 1],
    reward: 2_700,
  },
  {
    id: 5,
    name: '골렘 채석장',
    steps: 23,
    buildable: 48,
    hp: 1.38,
    speed: 1.06,
    spawn: 0.94,
    counts: [32, 60, 60, 30, 1],
    reward: 2_746,
  },
  {
    id: 6,
    name: '미노타우르스 관문',
    steps: 22,
    buildable: 46,
    hp: 1.52,
    speed: 1.08,
    spawn: 0.92,
    counts: [24, 54, 70, 31, 1],
    reward: 2_800,
  },
] as const;

describe('twelve-stage catalog', () => {
  it('defines the approved IDs, maps, multipliers, waves, and economy', () => {
    expect(STAGE_IDS).toEqual([1, 2, 3, 4, 5, 6]);
    expect(STAGE_CATALOG).toHaveLength(12);

    for (const expected of EXPECTED) {
      const stage = getStageDefinition(expected.id);
      expect(stage.key).toBe(`normal-${expected.id}`);
      expect(stage.number).toBe(expected.id);
      expect(stage.name).toBe(expected.name);
      expect(stage.map.pathCells.length - 1).toBe(expected.steps);
      expect(stage.map.buildableCells([])).toHaveLength(expected.buildable);
      expect(stage.hpMultiplier).toBe(expected.hp);
      expect(stage.speedMultiplier).toBe(expected.speed);
      expect(stage.spawnIntervalMultiplier).toBe(expected.spawn);
      expect(stage.waves).toHaveLength(10);

      const groups = stage.waves.flatMap((wave) => wave.groups);
      const counts = ['slime', 'fairy', 'orc', 'golem', 'minotaur'].map((type) => (
        groups.filter((group) => group.type === type)
          .reduce((sum, group) => sum + group.count, 0)
      ));
      expect(counts).toEqual(expected.counts);
      expect(groups.reduce((sum, group) => (
        sum + ENEMY_CATALOG[group.type].reward * group.count
      ), 0)).toBe(expected.reward);
      expect(stage.waves.slice(0, 9).flatMap((wave) => wave.groups)
        .filter((group) => group.type === 'minotaur')).toHaveLength(0);
      expect(stage.waves[9].groups.filter((group) => group.type === 'minotaur'))
        .toEqual([{ type: 'minotaur', count: 1, spawnInterval: 0 }]);
    }
  });

  it('normalizes invalid stage IDs to stage one', () => {
    for (const value of [0, 7, 1.5, Number.NaN, '2', null]) {
      expect(normalizeStageId(value)).toBe(1);
      expect(getStageDefinition(value).key).toBe('normal-1');
    }
  });

  it('normalizes stable mode-stage keys without treating nightmare as stage seven', () => {
    expect(ALL_STAGE_KEYS).toHaveLength(12);
    expect(NIGHTMARE_STAGE_KEYS).toEqual([
      'nightmare-1', 'nightmare-2', 'nightmare-3',
      'nightmare-4', 'nightmare-5', 'nightmare-6',
    ]);
    expect(normalizeStageKey(6)).toBe('normal-6');
    expect(normalizeStageKey('nightmare-6')).toBe('nightmare-6');
    expect(normalizeStageKey('nightmare-7')).toBe('normal-1');
    expect(stageRef('nightmare-4')).toEqual({
      key: 'nightmare-4',
      mode: 'nightmare',
      number: 4,
    });
  });

  it('defines the six approved nightmare maps and economy', () => {
    const expected = [
      ['달빛 늪', 30, 62, 1.00, 1.00, 1.00, 1.00, 18_500, 23_000],
      ['썩은 숲', 27, 56, 1.10, 1.02, 0.97, 1.04, 19_000, 23_500],
      ['잿빛 폐허', 25, 52, 1.21, 1.04, 0.94, 1.08, 19_500, 24_000],
      ['핏빛 협곡', 26, 54, 1.33, 1.06, 0.91, 1.12, 20_500, 25_000],
      ['흑요석 광산', 24, 50, 1.47, 1.08, 0.88, 1.16, 20_500, 25_000],
      ['심연의 성문', 23, 48, 1.62, 1.10, 0.85, 1.20, 21_500, 26_500],
    ] as const;

    for (const [index, row] of expected.entries()) {
      const stage = getStageDefinition(`nightmare-${index + 1}`);
      expect([
        stage.name,
        stage.map.pathCells.length - 1,
        stage.map.buildableCells([]).length,
        stage.hpMultiplier,
        stage.speedMultiplier,
        stage.spawnIntervalMultiplier,
        stage.countMultiplier,
        stage.twoStarScore,
        stage.threeStarScore,
      ]).toEqual(row);
      expect(stage.startingGold).toBe(280);
      expect(stage.baseHp).toBe(12);
      expect(stage.rewardMultiplier).toBe(0.85);
      expect(stage.scoreMultiplier).toBe(1.5);
    }
  });

  it('keeps every path in bounds, orthogonal, unique, and left-to-right', () => {
    for (const stage of STAGE_CATALOG) {
      const path = stage.map.pathCells;
      expect(path[0].col).toBe(0);
      expect(path.at(-1)?.col).toBe(19);
      expect(new Set(path.map(({ col, row }) => `${col}:${row}`)).size).toBe(path.length);
      expect(path.every(({ col, row }) => (
        col >= 0 && col < 20 && row >= 0 && row < 10
      ))).toBe(true);
      expect(path.slice(1).every((cell, index) => (
        Math.abs(cell.col - path[index].col) + Math.abs(cell.row - path[index].row) === 1
      ))).toBe(true);
    }
  });

  it('rejects malformed routes before they enter the catalog', () => {
    expect(() => createStageMap([{ col: 0, row: 0 }])).toThrow('at least two');
    expect(() => createStageMap([
      { col: 0, row: 0 },
      { col: 1, row: 1 },
    ])).toThrow('orthogonal');
    expect(() => createStageMap([
      { col: 0, row: 0 },
      { col: 20, row: 0 },
    ])).toThrow('out of bounds');
    expect(() => createStageMap([
      { col: 0, row: 0 },
      { col: 2, row: 0 },
      { col: 1, row: 0 },
    ])).toThrow('revisit');
  });
});
