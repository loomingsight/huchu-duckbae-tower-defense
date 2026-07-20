import { cellCenter } from '../core/geometry';
import { STAGE_1 } from '../map/stage1';
import { TOWER_CATALOG, type TowerType } from '../towers/towerCatalog';
import type { Cell } from '../types';
import type { GameState } from './createGame';

export type PlaceTowerResult =
  | { ok: true }
  | { ok: false; reason: 'insufficient-gold' | 'not-buildable' };

export function placeTower(
  state: GameState,
  type: TowerType,
  cell: Cell,
): PlaceTowerResult {
  const definition = TOWER_CATALOG[type];
  if (state.gold < definition.cost) {
    return { ok: false, reason: 'insufficient-gold' };
  }

  if (!STAGE_1.isBuildableCell(cell, state.towers.map((tower) => tower.cell))) {
    return { ok: false, reason: 'not-buildable' };
  }

  state.gold -= definition.cost;
  state.towers.push({
    id: state.nextTowerId,
    type,
    cell: { ...cell },
    position: cellCenter(cell),
    cooldownRemaining: 0,
  });
  state.nextTowerId += 1;
  return { ok: true };
}
