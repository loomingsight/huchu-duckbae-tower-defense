import { createFixedStepLoop, type FixedStepLoop } from '../game/core/fixedStepLoop';
import type { GameState, Outcome } from '../game/simulation/createGame';
import type { TowerType } from '../game/towers/towerCatalog';
import type { Cell } from '../game/types';
import type { GamePhase, GameSpeed } from './hud';

export type AnimationFrameScheduler = Readonly<{
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
}>;

export type GameRuntimeSnapshot = Readonly<{
  game: GameState;
  phase: GamePhase;
  speed: GameSpeed;
  selectedTower: TowerType | null;
  selectedCell: Cell | null;
  portraitBlocked: boolean;
  elapsedSeconds: number;
}>;

export type GameRuntimeDependencies = Readonly<{
  scheduler: AnimationFrameScheduler;
  createGame(): GameState;
  updateGame(state: GameState, deltaSeconds: number): void;
  render(): void;
  onOutcome?(outcome: Exclude<Outcome, 'playing'>, elapsedSeconds: number): void;
}>;

export type GameRuntime = Readonly<{
  startFrames(): void;
  startGame(): void;
  togglePause(): void;
  toggleSpeed(): void;
  selectTower(type: TowerType | null): void;
  setSelectedCell(cell: Cell | null): void;
  setPortraitBlocked(blocked: boolean): void;
  getSnapshot(): GameRuntimeSnapshot;
  renderNow(): void;
  destroy(): void;
}>;

export function createGameRuntime(dependencies: GameRuntimeDependencies): GameRuntime {
  let game = dependencies.createGame();
  let phase: GamePhase = 'ready';
  let speed: GameSpeed = 1;
  let selectedTower: TowerType | null = null;
  let selectedCell: Cell | null = null;
  let portraitBlocked = false;
  let elapsedSeconds = 0;
  let lastFrameMs: number | null = null;
  let frameId: number | null = null;
  let destroyed = false;
  let loop: FixedStepLoop;

  function snapshot(): GameRuntimeSnapshot {
    return {
      game,
      phase,
      speed,
      selectedTower,
      selectedCell,
      portraitBlocked,
      elapsedSeconds,
    };
  }

  function canUpdate(): boolean {
    return phase === 'playing' && !portraitBlocked;
  }

  function makeLoop(): FixedStepLoop {
    return createFixedStepLoop({
      update(deltaSeconds) {
        if (!canUpdate()) return;
        dependencies.updateGame(game, deltaSeconds);
        elapsedSeconds += deltaSeconds;
        if (game.outcome === 'playing') return;
        phase = game.outcome;
        selectedTower = null;
        selectedCell = null;
        dependencies.onOutcome?.(game.outcome, elapsedSeconds);
      },
      render: dependencies.render,
    });
  }

  loop = makeLoop();

  function scheduleFrame(): void {
    if (destroyed || frameId !== null) return;
    frameId = dependencies.scheduler.request(frame);
  }

  function frame(timestampMs: number): void {
    frameId = null;
    if (destroyed) return;
    const safeTimestamp = Number.isFinite(timestampMs) ? timestampMs : (lastFrameMs ?? 0);
    const deltaSeconds = lastFrameMs === null ? 0 : Math.max(0, (safeTimestamp - lastFrameMs) / 1000);
    lastFrameMs = safeTimestamp;
    loop.tick(deltaSeconds, canUpdate() ? speed : 0);
    scheduleFrame();
  }

  return {
    startFrames: scheduleFrame,
    startGame() {
      game = dependencies.createGame();
      phase = 'playing';
      speed = 1;
      selectedTower = null;
      selectedCell = null;
      elapsedSeconds = 0;
      loop = makeLoop();
      dependencies.render();
    },
    togglePause() {
      if (phase === 'playing') phase = 'paused';
      else if (phase === 'paused') phase = 'playing';
      dependencies.render();
    },
    toggleSpeed() {
      if (phase !== 'playing' && phase !== 'paused') return;
      speed = speed === 1 ? 2 : 1;
      dependencies.render();
    },
    selectTower(type) {
      if (selectedTower !== type) selectedCell = null;
      selectedTower = type;
      dependencies.render();
    },
    setSelectedCell(cell) {
      selectedCell = cell === null ? null : { ...cell };
      dependencies.render();
    },
    setPortraitBlocked(blocked) {
      if (portraitBlocked === blocked) return;
      portraitBlocked = blocked;
      dependencies.render();
    },
    getSnapshot: snapshot,
    renderNow: dependencies.render,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frameId !== null) dependencies.scheduler.cancel(frameId);
      frameId = null;
    },
  };
}
