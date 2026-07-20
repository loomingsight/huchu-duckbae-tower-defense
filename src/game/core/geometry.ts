import type { Cell, Vec2 } from '../types';

export function cellCenter(cell: Cell): Vec2 {
  return { x: cell.col + 0.5, y: cell.row + 0.5 };
}

export function worldToCell(point: Vec2): Cell {
  return { col: Math.floor(point.x), row: Math.floor(point.y) };
}
