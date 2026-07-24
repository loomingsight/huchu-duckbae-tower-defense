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

const splitOpenEvent = {
  kind: 'split-open' as const,
  enemyId: 1,
  position: { x: 0.5, y: 0.5 },
};

const shieldOpenEvent = {
  kind: 'shield-open' as const,
  enemyId: 7,
  position: { x: 4.5, y: 3.5 },
};

describe('nightmare-one trait onboarding state', () => {
  it('shows the fixed copy for 2.5 seconds after the first event', () => {
    const state = updateTraitNoticeState(
      createTraitNoticeState('nightmare-1'),
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
      createTraitNoticeState('nightmare-1'),
      [slowResistEvent],
      10,
    );
    const repeated = updateTraitNoticeState(first, [slowResistEvent], 11);

    expect(repeated).toEqual(first);
    expect(traitNoticeView(repeated, 12.5)).toBeNull();
  });

  it('ignores unrelated events and resets with a fresh state', () => {
    const untouched = updateTraitNoticeState(
      createTraitNoticeState('nightmare-1'),
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
    expect(traitNoticeView(createTraitNoticeState('nightmare-1'), 5)).toBeNull();
  });

  it('shows the split explanation only on the first shadow-slime appearance', () => {
    const first = updateTraitNoticeState(
      createTraitNoticeState('nightmare-1'),
      [splitOpenEvent],
      3,
    );

    expect(traitNoticeView(first, 3)).toEqual({
      title: '분열 슬라임 · 분열',
      body: '처치하면 작은 슬라임 2마리로 나뉘어요',
    });
    expect(traitNoticeView(first, 5.499)).not.toBeNull();
    expect(traitNoticeView(first, 5.5)).toBeNull();

    const repeated = updateTraitNoticeState(first, [splitOpenEvent], 6);
    expect(repeated).toMatchObject({
      splitShown: true,
      activeNotice: null,
      noticeEndsAt: null,
    });
    expect(traitNoticeView(repeated, 6)).toBeNull();
  });

  it('disables repeated monster explanations after nightmare one', () => {
    const nightmareOne = createTraitNoticeState('nightmare-1');
    const nightmareTwo = createTraitNoticeState('nightmare-2');
    const normal = createTraitNoticeState('normal-1');

    expect(nightmareOne.enabled).toBe(true);
    expect(nightmareTwo.enabled).toBe(false);
    expect(normal.enabled).toBe(false);
    expect(traitNoticeView(
      updateTraitNoticeState(nightmareTwo, [splitOpenEvent], 3),
      3,
    )).toBeNull();
    expect(traitNoticeView(
      updateTraitNoticeState(normal, [slowResistEvent], 3),
      3,
    )).toBeNull();
  });

  it('shows the sealed-shield explanation only on nightmare three', () => {
    const nightmareThree = updateTraitNoticeState(
      createTraitNoticeState('nightmare-3'),
      [shieldOpenEvent],
      8,
    );

    expect(traitNoticeView(nightmareThree, 8)).toEqual({
      title: '해골 기사 · 봉인 방패',
      body: '슬로우·덕배·후추로 방패를 해제하세요',
    });
    expect(traitNoticeView(nightmareThree, 10.499)).not.toBeNull();
    expect(traitNoticeView(nightmareThree, 10.5)).toBeNull();

    for (const stageKey of ['nightmare-2', 'nightmare-4', 'normal-3']) {
      const state = updateTraitNoticeState(
        createTraitNoticeState(stageKey),
        [shieldOpenEvent],
        8,
      );
      expect(traitNoticeView(state, 8)).toBeNull();
    }
  });

  it('does not repeat the sealed-shield explanation in the same attempt', () => {
    const first = updateTraitNoticeState(
      createTraitNoticeState('nightmare-3'),
      [shieldOpenEvent],
      4,
    );
    const expired = updateTraitNoticeState(first, [], 6.5);
    const repeated = updateTraitNoticeState(expired, [shieldOpenEvent], 7);

    expect(traitNoticeView(first, 4)).not.toBeNull();
    expect(traitNoticeView(repeated, 7)).toBeNull();
  });

  it('does not replay N1 split or slow-resistance notices on nightmare three', () => {
    const initial = createTraitNoticeState('nightmare-3');

    expect(traitNoticeView(
      updateTraitNoticeState(initial, [splitOpenEvent], 3),
      3,
    )).toBeNull();
    expect(traitNoticeView(
      updateTraitNoticeState(initial, [slowResistEvent], 3),
      3,
    )).toBeNull();
  });
});
