import { describe, expect, it } from 'vitest';

import {
  createTraitNoticeState,
  SLOW_RESIST_NOTICE_DURATION_SECONDS,
  traitNoticeView,
  updateTraitNoticeState,
} from '../../src/app/traitNotice';

const slowResistEvent = {
  kind: 'slow-resist' as const,
  enemyId: 4,
  position: { x: 3.5, y: 2.5 },
};

describe('slow resistance onboarding state', () => {
  it('shows the fixed copy for 2.5 seconds after the first event', () => {
    const state = updateTraitNoticeState(
      createTraitNoticeState(),
      [slowResistEvent],
      10,
    );

    expect(SLOW_RESIST_NOTICE_DURATION_SECONDS).toBe(2.5);
    expect(traitNoticeView(state, 10)).toEqual({
      title: '흡혈 박쥐 · 둔화 저항',
      body: '슬로우 효과가 50%만 적용돼요',
    });
    expect(traitNoticeView(state, 12.499)).not.toBeNull();
    expect(traitNoticeView(state, 12.5)).toBeNull();
  });

  it('does not extend the notice for later events in the same attempt', () => {
    const first = updateTraitNoticeState(
      createTraitNoticeState(),
      [slowResistEvent],
      10,
    );
    const repeated = updateTraitNoticeState(first, [slowResistEvent], 11);

    expect(repeated).toEqual(first);
    expect(traitNoticeView(repeated, 12.5)).toBeNull();
  });

  it('ignores unrelated events and resets with a fresh state', () => {
    const untouched = updateTraitNoticeState(
      createTraitNoticeState(),
      [{
        kind: 'shield-block',
        enemyId: 2,
        position: { x: 1.5, y: 2.5 },
      }],
      4,
    );
    expect(traitNoticeView(untouched, 4)).toBeNull();

    const shown = updateTraitNoticeState(
      untouched,
      [slowResistEvent],
      5,
    );
    expect(traitNoticeView(shown, 5)).not.toBeNull();
    expect(traitNoticeView(createTraitNoticeState(), 5)).toBeNull();
  });
});
