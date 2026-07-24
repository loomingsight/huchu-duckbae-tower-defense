import { describe, expect, it } from 'vitest';

import { cellCenter } from '../../src/game/core/geometry';
import { calculateGameScore } from '../../src/game/scoring';
import { createGame } from '../../src/game/simulation/createGame';
import { placeTower } from '../../src/game/simulation/placeTower';
import { updateGame } from '../../src/game/simulation/updateGame';
import { getStageDefinition } from '../../src/game/stages/stageCatalog';
import type { StageNumber } from '../../src/game/stages/stageIdentity';
import {
  TOWER_CATALOG,
  type TowerType,
} from '../../src/game/towers/towerCatalog';

type Build = Readonly<{
  type: TowerType;
  col: number;
  row: number;
}>;

type NightmareStageKey = `nightmare-${StageNumber}`;

const TESTED_NIGHTMARE_STAGE_KEYS = [
  'nightmare-2',
  'nightmare-3',
  'nightmare-4',
  'nightmare-5',
  'nightmare-6',
] as const satisfies readonly NightmareStageKey[];

type TestedNightmareStageKey = (typeof TESTED_NIGHTMARE_STAGE_KEYS)[number];

const N2_OPENING: readonly Build[] = [
  { type: 'arrow', col: 5, row: 3 },
  { type: 'arrow', col: 9, row: 6 },
  { type: 'slow', col: 8, row: 6 },
  { type: 'arrow', col: 13, row: 5 },
  { type: 'arrow', col: 3, row: 3 },
  { type: 'arrow', col: 7, row: 5 },
  { type: 'arrow', col: 11, row: 5 },
  { type: 'arrow', col: 15, row: 5 },
  { type: 'arrow', col: 5, row: 1 },
  { type: 'arrow', col: 13, row: 7 },
  { type: 'arrow', col: 17, row: 5 },
];

function cellKey({ col, row }: Readonly<{ col: number; row: number }>): string {
  return `${col}:${row}`;
}

function pathCoverage(stageKey: TestedNightmareStageKey, build: Build): number {
  const stage = getStageDefinition(stageKey);
  const center = cellCenter(build);
  const range = TOWER_CATALOG[build.type].range;
  return stage.map.pathCells.filter((pathCell) => {
    const pathCenter = cellCenter(pathCell);
    return Math.hypot(pathCenter.x - center.x, pathCenter.y - center.y) <= range;
  }).length;
}

function rankedBuilds(
  stageKey: TestedNightmareStageKey,
  type: TowerType,
  occupied: ReadonlySet<string>,
): readonly Build[] {
  return getStageDefinition(stageKey).map.buildableCells([])
    .filter((cell) => !occupied.has(cellKey(cell)))
    .map(({ col, row }) => ({ type, col, row }))
    .sort((left, right) => (
      pathCoverage(stageKey, right) - pathCoverage(stageKey, left)
      || left.col - right.col
      || left.row - right.row
    ));
}

function mixedBuildOrder(stageKey: TestedNightmareStageKey): readonly Build[] {
  if (stageKey !== 'nightmare-2') {
    const arrowBuilds = rankedBuilds(stageKey, 'arrow', new Set());
    const arrowOpening = arrowBuilds.slice(0, 3);
    const occupied = new Set(arrowOpening.map(cellKey));
    const slow = rankedBuilds(stageKey, 'slow', occupied)[0];
    occupied.add(cellKey(slow));

    return [
      ...arrowOpening,
      slow,
      ...arrowBuilds.filter((build) => !occupied.has(cellKey(build))),
    ];
  }

  const occupied = new Set(N2_OPENING.map(cellKey));
  return [
    ...N2_OPENING,
    ...rankedBuilds(stageKey, 'arrow', occupied),
  ];
}

function arrowOnlyBuildOrder(
  stageKey: TestedNightmareStageKey,
): readonly Build[] {
  return rankedBuilds(stageKey, 'arrow', new Set());
}

function simulateBuildOrder(
  stageKey: TestedNightmareStageKey,
  buildOrder: readonly Build[],
) {
  const state = createGame(stageKey);
  let nextBuild = 0;

  for (
    let step = 0;
    step < 60 * 480 && state.outcome === 'playing';
    step += 1
  ) {
    while (
      nextBuild < buildOrder.length
      && state.gold >= TOWER_CATALOG[buildOrder[nextBuild].type].cost
    ) {
      const build = buildOrder[nextBuild];
      expect(placeTower(state, build.type, build)).toEqual({ ok: true });
      nextBuild += 1;
    }
    updateGame(state, 1 / 60);
  }

  return {
    state,
    score: calculateGameScore(state, state.outcome, state.elapsedSeconds),
  };
}

describe('nightmare balance viability', () => {
  it.each(TESTED_NIGHTMARE_STAGE_KEYS)(
    'clears %s with a slow-and-arrow opening',
    (stageKey) => {
      const { state, score } = simulateBuildOrder(
        stageKey,
        mixedBuildOrder(stageKey),
      );
      expect(state.outcome, JSON.stringify({
        stageKey,
        baseHp: state.baseHp,
        completedWaves: state.stats.completedWaves,
        gold: state.gold,
        towers: state.towers.map(({ type, cell }) => ({
          type,
          ...cell,
          coverage: pathCoverage(stageKey, { type, ...cell }),
        })),
        score,
      })).toBe('victory');
      expect(score.stars).toBeGreaterThanOrEqual(2);
      expect(state.towers.some(({ type }) => type === 'slow')).toBe(true);
    },
  );

  it.each([
    'nightmare-3',
    'nightmare-4',
    'nightmare-5',
    'nightmare-6',
  ] satisfies readonly TestedNightmareStageKey[])(
    'defeats an arrow-only build on %s',
    (stageKey) => {
      const { state } = simulateBuildOrder(
        stageKey,
        arrowOnlyBuildOrder(stageKey),
      );

      expect(state.towers.every(({ type }) => type === 'arrow')).toBe(true);
      expect(state.outcome).toBe('defeat');
    },
  );

});
