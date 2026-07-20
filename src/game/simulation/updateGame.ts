import type { GameState } from './createGame';
import { updateEnemies } from './updateEnemies';
import { updateWaves } from './updateWaves';

export function updateGame(state: GameState, dt: number): void {
  if (state.outcome !== 'playing') return;

  updateWaves(state, dt);
  updateEnemies(state, dt);

  if (state.outcome === 'playing' && state.wave.allSpawned && state.enemies.length === 0) {
    state.outcome = 'victory';
  }
}
