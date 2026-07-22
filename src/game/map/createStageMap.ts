import { GRID_HEIGHT, GRID_WIDTH } from '../config';
import type { Cell } from '../types';

export type StageMap = Readonly<{
  width: number;
  height: number;
  pathCells: readonly Cell[];
  isPathCell(cell: Readonly<Cell>): boolean;
  isRoadAdjacentCell(cell: Readonly<Cell>): boolean;
  isBuildableCell(
    cell: Readonly<Cell>,
    occupiedCells: readonly Readonly<Cell>[],
  ): boolean;
  buildableCells(occupiedCells: readonly Readonly<Cell>[]): Cell[];
}>;

function isInBounds(cell: Readonly<Cell>): boolean {
  return Number.isInteger(cell.col)
    && Number.isInteger(cell.row)
    && cell.col >= 0
    && cell.col < GRID_WIDTH
    && cell.row >= 0
    && cell.row < GRID_HEIGHT;
}

export function createStageMap(waypoints: readonly Readonly<Cell>[]): StageMap {
  if (waypoints.length < 2) {
    throw new Error('A stage route needs at least two waypoints');
  }

  const pathCells: Cell[] = [];
  const pathCellKeys = new Set<string>();
  const append = (cell: Cell): void => {
    if (!isInBounds(cell)) throw new Error('Stage waypoint is out of bounds');
    const key = `${cell.col}:${cell.row}`;
    if (pathCellKeys.has(key)) throw new Error('Stage route cannot revisit a cell');
    pathCellKeys.add(key);
    pathCells.push({ ...cell });
  };

  append({ ...waypoints[0] });
  for (let index = 1; index < waypoints.length; index += 1) {
    const previous = waypoints[index - 1];
    const next = waypoints[index];
    const horizontal = previous.row === next.row && previous.col !== next.col;
    const vertical = previous.col === next.col && previous.row !== next.row;
    if (!horizontal && !vertical) {
      throw new Error('Stage route segments must be orthogonal');
    }

    const colStep = Math.sign(next.col - previous.col);
    const rowStep = Math.sign(next.row - previous.row);
    for (
      let col = previous.col + colStep, row = previous.row + rowStep;
      col !== next.col + colStep || row !== next.row + rowStep;
      col += colStep, row += rowStep
    ) {
      append({ col, row });
    }
  }

  const isPathCell = (cell: Readonly<Cell>): boolean => (
    pathCellKeys.has(`${cell.col}:${cell.row}`)
  );
  const isRoadAdjacentCell = (cell: Readonly<Cell>): boolean => pathCells.some((pathCell) => (
    Math.max(
      Math.abs(pathCell.col - cell.col),
      Math.abs(pathCell.row - cell.row),
    ) === 1
  ));
  const isBuildableCell = (
    cell: Readonly<Cell>,
    occupiedCells: readonly Readonly<Cell>[],
  ): boolean => isInBounds(cell)
    && !isPathCell(cell)
    && isRoadAdjacentCell(cell)
    && !occupiedCells.some((occupied) => (
      occupied.col === cell.col && occupied.row === cell.row
    ));
  const buildableCells = (occupiedCells: readonly Readonly<Cell>[]): Cell[] => Array.from(
    { length: GRID_HEIGHT * GRID_WIDTH },
    (_, index) => ({
      col: index % GRID_WIDTH,
      row: Math.floor(index / GRID_WIDTH),
    }),
  ).filter((cell) => isBuildableCell(cell, occupiedCells));

  return {
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    pathCells,
    isPathCell,
    isRoadAdjacentCell,
    isBuildableCell,
    buildableCells,
  };
}
