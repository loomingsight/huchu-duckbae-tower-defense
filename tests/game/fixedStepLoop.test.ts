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
});
