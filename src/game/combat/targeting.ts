import { cellCenter } from '../core/geometry';
import { STAGE_1 } from '../map/stage1';
import { TOWER_CATALOG } from '../towers/towerCatalog';
import type { Vec2 } from '../types';
import type { GameEnemy, GameTower } from '../simulation/createGame';
import { isWithinRadius } from './radius';

export function enemyPosition(enemy: GameEnemy): Vec2 | undefined {
  if (!Number.isFinite(enemy.progress)) return undefined;

  const lastIndex = STAGE_1.pathCells.length - 1;
  const progress = Math.max(0, Math.min(enemy.progress, lastIndex));
  const startIndex = Math.floor(progress);
  const endIndex = Math.min(startIndex + 1, lastIndex);
  const fraction = progress - startIndex;
  const start = cellCenter(STAGE_1.pathCells[startIndex]);
  const end = cellCenter(STAGE_1.pathCells[endIndex]);

  return {
    x: start.x + (end.x - start.x) * fraction,
    y: start.y + (end.y - start.y) * fraction,
  };
}

export function selectTarget(
  tower: GameTower,
  enemies: readonly GameEnemy[],
): GameEnemy | undefined {
  const range = TOWER_CATALOG[tower.type].range;
  let selected: GameEnemy | undefined;

  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const position = enemyPosition(enemy);
    if (position === undefined) continue;
    if (!isWithinRadius(tower.position, position, range)) continue;

    if (
      selected === undefined
      || enemy.progress > selected.progress
      || (enemy.progress === selected.progress && enemy.id < selected.id)
    ) {
      selected = enemy;
    }
  }

  return selected;
}
