import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BASE_HIT_SHAKE_CLEANUP_MS,
  BASE_HIT_SHAKE_CLASS,
  createBaseHitFeedback,
} from '../../src/app/baseHitFeedback';

afterEach(() => {
  vi.useRealTimers();
});

function feedbackTarget() {
  const calls: string[] = [];
  const classes = new Set<string>();
  let reflowReads = 0;
  return {
    calls,
    classes,
    reflowReads: () => reflowReads,
    target: {
      classList: {
        add: (name: string) => {
          calls.push(`add:${name}`);
          classes.add(name);
        },
        remove: (name: string) => {
          calls.push(`remove:${name}`);
          classes.delete(name);
        },
      },
      get offsetWidth() {
        reflowReads += 1;
        return 844;
      },
    },
  };
}

describe('warehouse hit feedback', () => {
  it('restarts the full-screen class pulse for repeated hits', () => {
    vi.useFakeTimers();
    const fixture = feedbackTarget();
    const feedback = createBaseHitFeedback(fixture.target);

    feedback.trigger();
    feedback.trigger();

    expect(fixture.calls.filter(
      (call) => call === `add:${BASE_HIT_SHAKE_CLASS}`,
    )).toHaveLength(2);
    expect(fixture.reflowReads()).toBe(2);
    expect(fixture.classes.has(BASE_HIT_SHAKE_CLASS)).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('removes the shake class after the latest cleanup deadline', () => {
    vi.useFakeTimers();
    const fixture = feedbackTarget();
    const feedback = createBaseHitFeedback(fixture.target);

    feedback.trigger();
    vi.advanceTimersByTime(BASE_HIT_SHAKE_CLEANUP_MS - 1);
    expect(fixture.classes.has(BASE_HIT_SHAKE_CLASS)).toBe(true);

    vi.advanceTimersByTime(1);
    expect(fixture.classes.has(BASE_HIT_SHAKE_CLASS)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up immediately when destroyed', () => {
    vi.useFakeTimers();
    const fixture = feedbackTarget();
    const feedback = createBaseHitFeedback(fixture.target);

    feedback.trigger();
    feedback.destroy();

    expect(fixture.classes.has(BASE_HIT_SHAKE_CLASS)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
