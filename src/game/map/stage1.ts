import { GRID_HEIGHT, GRID_WIDTH } from '../config';
import type { Cell } from '../types';

const WAYPOINTS: readonly Cell[] = [
  { col: 0, row: 2 },
  { col: 5, row: 2 },
  { col: 5, row: 7 },
  { col: 12, row: 7 },
  { col: 12, row: 3 },
  { col: 19, row: 3 },
];

function expandPath(waypoints: readonly Cell[]): Cell[] {
  const pathCells: Cell[] = [{ ...waypoints[0] }];

  for (let index = 1; index < waypoints.length; index += 1) {
    const previous = waypoints[index - 1];
    const next = waypoints[index];
    const colStep = Math.sign(next.col - previous.col);
    const rowStep = Math.sign(next.row - previous.row);

    for (
      let cell = { col: previous.col + colStep, row: previous.row + rowStep };
      cell.col !== next.col + colStep || cell.row !== next.row + rowStep;
      cell = { col: cell.col + colStep, row: cell.row + rowStep }
    ) {
      pathCells.push(cell);
    }
  }

  return pathCells;
}

const pathCells = expandPath(WAYPOINTS);
const pathCellKeys = new Set(pathCells.map(({ col, row }) => `${col}:${row}`));

function isRoadAdjacentCell(cell: Readonly<Cell>): boolean {
  return pathCells.some((pathCell) => {
    const colDistance = Math.abs(pathCell.col - cell.col);
    const rowDistance = Math.abs(pathCell.row - cell.row);
    return Math.max(colDistance, rowDistance) === 1;
  });
}

function isBuildableCell(cell: Cell, occupiedCells: readonly Cell[]): boolean {
  const isInBounds = Number.isInteger(cell.col)
    && Number.isInteger(cell.row)
    && cell.col >= 0
    && cell.col < GRID_WIDTH
    && cell.row >= 0
    && cell.row < GRID_HEIGHT;
  if (
    !isInBounds
    || pathCellKeys.has(`${cell.col}:${cell.row}`)
    || !isRoadAdjacentCell(cell)
  ) {
    return false;
  }

  return !occupiedCells.some((occupied) => occupied.col === cell.col && occupied.row === cell.row);
}

export const STAGE_1 = {
  width: GRID_WIDTH,
  height: GRID_HEIGHT,
  pathCells,
  isRoadAdjacentCell,
  isBuildableCell,
};
