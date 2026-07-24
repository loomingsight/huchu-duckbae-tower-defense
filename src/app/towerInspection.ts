import type { GameTower } from '../game/simulation/createGame';
import type { Cell } from '../game/types';

export function towerAtCell(
  towers: readonly Readonly<GameTower>[],
  cell: Readonly<Cell>,
): Readonly<GameTower> | null {
  return towers.find((tower) => (
    tower.cell.col === cell.col && tower.cell.row === cell.row
  )) ?? null;
}

export function towerById(
  towers: readonly Readonly<GameTower>[],
  id: number,
): Readonly<GameTower> | null {
  return towers.find((tower) => tower.id === id) ?? null;
}
