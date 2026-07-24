import type { EnemyTraitVisualEvent } from '../game/enemies/enemyTraits';

export const SLOW_RESIST_NOTICE_DURATION_SECONDS = 2.5;

type ActiveTraitNotice = 'slow-resistance' | 'split';

export type TraitNoticeState = Readonly<{
  slowResistanceShown: boolean;
  splitShown: boolean;
  activeNotice: ActiveTraitNotice | null;
  noticeEndsAt: number | null;
}>;

export type TraitNoticeView =
  | Readonly<{
    title: '흡혈 박쥐 · 둔화 저항';
    body: '슬로우 효과가 50%만 적용돼요';
  }>
  | Readonly<{
    title: '분열 슬라임 · 분열';
    body: '처치하면 작은 슬라임 2마리로 나뉘어요';
  }>;

const SLOW_RESISTANCE_VIEW: TraitNoticeView = {
  title: '흡혈 박쥐 · 둔화 저항',
  body: '슬로우 효과가 50%만 적용돼요',
};

const SPLIT_VIEW: TraitNoticeView = {
  title: '분열 슬라임 · 분열',
  body: '처치하면 작은 슬라임 2마리로 나뉘어요',
};

function safeTime(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function createTraitNoticeState(): TraitNoticeState {
  return {
    slowResistanceShown: false,
    splitShown: false,
    activeNotice: null,
    noticeEndsAt: null,
  };
}

export function updateTraitNoticeState(
  state: TraitNoticeState,
  events: readonly EnemyTraitVisualEvent[],
  elapsedSeconds: number,
): TraitNoticeState {
  const now = safeTime(elapsedSeconds);
  if (state.noticeEndsAt !== null && now < state.noticeEndsAt) return state;

  if (!state.splitShown && events.some(({ kind }) => kind === 'split-open')) {
    return {
      ...state,
      splitShown: true,
      activeNotice: 'split',
      noticeEndsAt: now + SLOW_RESIST_NOTICE_DURATION_SECONDS,
    };
  }
  if (
    !state.slowResistanceShown
    && events.some(({ kind }) => kind === 'slow-resist')
  ) {
    return {
      ...state,
      slowResistanceShown: true,
      activeNotice: 'slow-resistance',
      noticeEndsAt: now + SLOW_RESIST_NOTICE_DURATION_SECONDS,
    };
  }
  if (state.activeNotice === null) return state;
  return {
    ...state,
    activeNotice: null,
    noticeEndsAt: null,
  };
}

export function traitNoticeView(
  state: TraitNoticeState,
  elapsedSeconds: number,
): TraitNoticeView | null {
  if (
    state.activeNotice === null
    || state.noticeEndsAt === null
    || safeTime(elapsedSeconds) >= state.noticeEndsAt
  ) return null;
  return state.activeNotice === 'split'
    ? SPLIT_VIEW
    : SLOW_RESISTANCE_VIEW;
}
