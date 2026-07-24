import { describe, expect, it } from 'vitest';

import { cellCenter } from '../../src/game/core/geometry';
import { calculateGameScore } from '../../src/game/scoring';
import { createGame } from '../../src/game/simulation/createGame';
import { placeTower } from '../../src/game/simulation/placeTower';
import { updateGame } from '../../src/game/simulation/updateGame';
import { getStageDefinition } from '../../src/game/stages/stageCatalog';
import {
  TOWER_CATALOG,
  type TowerType,
} from '../../src/game/towers/towerCatalog';

type Build = Readonly<{
  type: TowerType;
  col: number;
  row: number;
}>;

function pathCoverage(build: Build): number {
  const stage = getStageDefinition('nightmare-2');
  const center = cellCenter(build);
  const range = TOWER_CATALOG[build.type].range;
  return stage.map.pathCells.filter((pathCell) => {
    const pathCenter = cellCenter(pathCell);
    return Math.hypot(pathCenter.x - center.x, pathCenter.y - center.y) <= range;
  }).length;
}

function mixedN2BuildOrder(): readonly Build[] {
  const stage = getStageDefinition('nightmare-2');
  const opening: readonly Build[] = [
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
  const occupied = new Set(opening.map(({ col, row }) => `${col}:${row}`));
  const remainingArrows = stage.map.buildableCells([])
    .filter(({ col, row }) => !occupied.has(`${col}:${row}`))
    .map(({ col, row }) => ({ type: 'arrow' as const, col, row }))
    .sort((left, right) => (
      pathCoverage(right) - pathCoverage(left)
      || left.col - right.col
      || left.row - right.row
    ));
  return [...opening, ...remainingArrows];
}

describe('nightmare balance viability', () => {
  it('clears N2 with a slow-and-arrow opening', () => {
    const state = createGame('nightmare-2');
    const buildOrder = mixedN2BuildOrder();
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

    const score = calculateGameScore(state, state.outcome, state.elapsedSeconds);
    expect(state.outcome).toBe('victory');
    expect(score.stars).toBeGreaterThanOrEqual(2);
    expect(state.towers.some(({ type }) => type === 'slow')).toBe(true);
  });
});
