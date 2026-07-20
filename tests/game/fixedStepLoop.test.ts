import { describe, expect, it } from 'vitest';
import { createFixedStepLoop } from '../../src/game/core/fixedStepLoop';

describe('fixed-step loop', () => {
  it('runs six 1/60-second updates and one render for a 0.1-second frame', () => {
    const updates: number[] = [];
    let renders = 0;
    const loop = createFixedStepLoop({
      update: (deltaSeconds) => updates.push(deltaSeconds),
      render: () => { renders += 1; },
    });

    loop.tick(0.1);

    expect(updates).toEqual(Array.from({ length: 6 }, () => 1 / 60));
    expect(renders).toBe(1);
  });

  it('clamps a single frame delta to a quarter second', () => {
    const updates: number[] = [];
    const loop = createFixedStepLoop({
      update: (deltaSeconds) => updates.push(deltaSeconds),
      render: () => undefined,
    });

    loop.tick(1);

    expect(updates).toHaveLength(15);
  });

  it('clamps real frame time before applying a 2x time scale', () => {
    const singleFrameUpdates: number[] = [];
    const partitionedFrameUpdates: number[] = [];
    const singleFrameLoop = createFixedStepLoop({
      update: (deltaSeconds) => singleFrameUpdates.push(deltaSeconds),
      render: () => undefined,
    });
    const partitionedFrameLoop = createFixedStepLoop({
      update: (deltaSeconds) => partitionedFrameUpdates.push(deltaSeconds),
      render: () => undefined,
    });

    singleFrameLoop.tick(0.2, 2);
    partitionedFrameLoop.tick(0.1, 2);
    partitionedFrameLoop.tick(0.1, 2);

    expect(singleFrameUpdates).toHaveLength(24);
    expect(partitionedFrameUpdates).toHaveLength(24);
    expect(singleFrameUpdates).toEqual(partitionedFrameUpdates);
  });

  it('keeps 1x behavior unchanged and scales a clamped 250ms frame to 500ms', () => {
    const oneTimesUpdates: number[] = [];
    const twoTimesUpdates: number[] = [];
    const oneTimesLoop = createFixedStepLoop({
      update: (deltaSeconds) => oneTimesUpdates.push(deltaSeconds),
      render: () => undefined,
    });
    const twoTimesLoop = createFixedStepLoop({
      update: (deltaSeconds) => twoTimesUpdates.push(deltaSeconds),
      render: () => undefined,
    });

    oneTimesLoop.tick(0.25, 1);
    twoTimesLoop.tick(0.25, 2);

    expect(oneTimesUpdates).toHaveLength(15);
    expect(twoTimesUpdates).toHaveLength(30);
    expect(new Set([...oneTimesUpdates, ...twoTimesUpdates])).toEqual(new Set([1 / 60]));
  });

  it('treats invalid time scales as stopped without poisoning later ticks', () => {
    const updates: number[] = [];
    let renders = 0;
    const loop = createFixedStepLoop({
      update: (deltaSeconds) => updates.push(deltaSeconds),
      render: () => { renders += 1; },
    });

    loop.tick(0.1, -1);
    loop.tick(0.1, Number.NaN);
    loop.tick(0.1, Number.POSITIVE_INFINITY);
    loop.tick(0.1, Number.NEGATIVE_INFINITY);
    loop.tick(0.1, 1);

    expect(updates).toHaveLength(6);
    expect(renders).toBe(5);
  });

  it('ignores invalid frame deltas without poisoning later valid ticks', () => {
    const updates: number[] = [];
    let renders = 0;
    const loop = createFixedStepLoop({
      update: (deltaSeconds) => updates.push(deltaSeconds),
      render: () => { renders += 1; },
    });

    loop.tick(-1);
    loop.tick(Number.NaN);
    loop.tick(Number.POSITIVE_INFINITY);
    loop.tick(Number.NEGATIVE_INFINITY);
    loop.tick(0.1);

    expect(updates).toEqual(Array.from({ length: 6 }, () => 1 / 60));
    expect(renders).toBe(5);
  });
});
