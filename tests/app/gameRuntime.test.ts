import { describe, expect, it } from 'vitest';

import { createGame } from '../../src/game/simulation/createGame';
import {
  createGameRuntime,
  type AnimationFrameScheduler,
} from '../../src/app/gameRuntime';

class FakeScheduler implements AnimationFrameScheduler {
  private nextId = 1;
  callbacks = new Map<number, FrameRequestCallback>();
  cancelled: number[] = [];

  request(callback: FrameRequestCallback): number {
    const id = this.nextId;
    this.nextId += 1;
    this.callbacks.set(id, callback);
    return id;
  }

  cancel(id: number): void {
    this.cancelled.push(id);
    this.callbacks.delete(id);
  }

  frame(timestamp: number): void {
    const entry = this.callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
    if (entry === undefined) throw new Error('No requested frame');
    this.callbacks.delete(entry[0]);
    entry[1](timestamp);
  }
}

function setupRuntime(update: (delta: number) => void = () => undefined) {
  const scheduler = new FakeScheduler();
  let renders = 0;
  const runtime = createGameRuntime({
    scheduler,
    createGame,
    updateGame(state, delta) {
      update(delta);
      if (state.baseHp < 0) state.outcome = 'defeat';
    },
    render: () => { renders += 1; },
  });
  return { runtime, scheduler, renders: () => renders };
}

describe('GameRuntime lifecycle', () => {
  it('keeps one RAF across repeated restarts and cancels it on destroy', () => {
    const { runtime, scheduler } = setupRuntime();

    runtime.startFrames();
    runtime.startGame();
    runtime.startGame();
    expect(scheduler.callbacks.size).toBe(1);

    scheduler.frame(0);
    expect(scheduler.callbacks.size).toBe(1);

    runtime.destroy();
    expect(scheduler.callbacks.size).toBe(0);
    expect(scheduler.cancelled).toHaveLength(1);
  });

  it('stops updates during pause and portrait while rendering every frame without catch-up', () => {
    const updates: number[] = [];
    const { runtime, scheduler, renders } = setupRuntime((delta) => updates.push(delta));
    runtime.startFrames();
    runtime.startGame();
    runtime.toggleSpeed();

    scheduler.frame(0);
    scheduler.frame(100);
    expect(updates).toHaveLength(12);

    runtime.togglePause();
    scheduler.frame(200);
    expect(updates).toHaveLength(12);

    runtime.togglePause();
    runtime.setPortraitBlocked(true);
    scheduler.frame(1_200);
    expect(updates).toHaveLength(12);

    runtime.setPortraitBlocked(false);
    scheduler.frame(1_300);
    expect(updates).toHaveLength(24);
    expect(renders()).toBeGreaterThanOrEqual(5);
  });

  it('advances 500ms of simulation for one 250ms frame at 2x', () => {
    const updates: number[] = [];
    const { runtime, scheduler } = setupRuntime((delta) => updates.push(delta));
    runtime.startFrames();
    runtime.startGame();
    runtime.toggleSpeed();

    scheduler.frame(0);
    scheduler.frame(250);

    expect(updates).toHaveLength(30);
    expect(runtime.getSnapshot().elapsedSeconds).toBeCloseTo(0.5, 10);
    expect(new Set(updates)).toEqual(new Set([1 / 60]));
  });

  it('stops after a terminal outcome but keeps rendering', () => {
    let updates = 0;
    const scheduler = new FakeScheduler();
    let renders = 0;
    const runtime = createGameRuntime({
      scheduler,
      createGame,
      updateGame(state) {
        updates += 1;
        state.outcome = 'victory';
      },
      render: () => { renders += 1; },
    });
    runtime.startFrames();
    runtime.startGame();
    runtime.toggleSpeed();

    scheduler.frame(0);
    scheduler.frame(100);
    const rendersAtVictory = renders;
    scheduler.frame(200);

    expect(runtime.getSnapshot().phase).toBe('victory');
    expect(updates).toBe(1);
    expect(renders).toBe(rendersAtVictory + 1);
  });

  it('restart resets state, speed, selection, elapsed time, and fixed-step accumulator', () => {
    let updates = 0;
    const { runtime, scheduler } = setupRuntime(() => { updates += 1; });
    runtime.startFrames();
    runtime.startGame();
    const firstGame = runtime.getSnapshot().game;
    runtime.toggleSpeed();
    runtime.selectTower('arrow');
    runtime.setSelectedCell({ col: 2, row: 5 });

    scheduler.frame(0);
    scheduler.frame(5);
    runtime.startGame();
    scheduler.frame(10);

    const snapshot = runtime.getSnapshot();
    expect(snapshot.game).not.toBe(firstGame);
    expect(snapshot.speed).toBe(1);
    expect(snapshot.selectedTower).toBeNull();
    expect(snapshot.selectedCell).toBeNull();
    expect(snapshot.inspectedTowerId).toBeNull();
    expect(snapshot.elapsedSeconds).toBe(0);
    expect(updates).toBe(0);
  });

  it('changing tower type clears the selected cell', () => {
    const { runtime } = setupRuntime();
    runtime.startGame();
    runtime.selectTower('arrow');
    runtime.setSelectedCell({ col: 2, row: 5 });
    runtime.selectTower('slow');

    expect(runtime.getSnapshot().selectedCell).toBeNull();
  });

  it('tracks one inspected tower independently and clears placement state', () => {
    const { runtime } = setupRuntime();
    runtime.startGame();
    runtime.selectTower('arrow');
    runtime.setSelectedCell({ col: 2, row: 5 });

    runtime.inspectTower(7);
    expect(runtime.getSnapshot()).toMatchObject({
      selectedTower: null,
      selectedCell: null,
      inspectedTowerId: 7,
    });

    runtime.inspectTower(9);
    expect(runtime.getSnapshot().inspectedTowerId).toBe(9);

    runtime.selectTower('slow');
    expect(runtime.getSnapshot().inspectedTowerId).toBeNull();
  });

  it('normalizes invalid inspection IDs and clears inspection on restart', () => {
    const { runtime } = setupRuntime();
    runtime.startGame();

    runtime.inspectTower(Number.NaN);
    expect(runtime.getSnapshot().inspectedTowerId).toBeNull();

    runtime.inspectTower(3);
    runtime.startGame();
    expect(runtime.getSnapshot().inspectedTowerId).toBeNull();
  });
});
