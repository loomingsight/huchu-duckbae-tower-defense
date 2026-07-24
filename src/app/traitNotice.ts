import type { EnemyTraitVisualEvent } from '../game/enemies/enemyTraits';
import { normalizeStageKey } from '../game/stages/stageIdentity';

export const SLOW_RESIST_NOTICE_DURATION_SECONDS = 2.5;

type ActiveTraitNotice = 'slow-resistance' | 'split' | 'shield-counter';

export type TraitNoticeState = Readonly<{
  enabled: boolean;
  baseNoticesEnabled: boolean;
  shieldCounterEnabled: boolean;
  slowResistanceShown: boolean;
  splitShown: boolean;
  shieldCounterShown: boolean;
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
  }>
  | Readonly<{
    title: '해골 기사 · 봉인 방패';
    body: '슬로우·덕배·후추로 방패를 해제하세요';
  }>;

const SLOW_RESISTANCE_VIEW: TraitNoticeView = {
  title: '흡혈 박쥐 · 둔화 저항',
  body: '슬로우 효과가 50%만 적용돼요',
};

const SPLIT_VIEW: TraitNoticeView = {
  title: '분열 슬라임 · 분열',
  body: '처치하면 작은 슬라임 2마리로 나뉘어요',
};

const SHIELD_COUNTER_VIEW: TraitNoticeView = {
  title: '해골 기사 · 봉인 방패',
  body: '슬로우·덕배·후추로 방패를 해제하세요',
};

function safeTime(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function createTraitNoticeState(stageKey: unknown): TraitNoticeState {
  const key = normalizeStageKey(stageKey);
  const baseNoticesEnabled = key === 'nightmare-1';
  const shieldCounterEnabled = key === 'nightmare-3';
  return {
    enabled: baseNoticesEnabled || shieldCounterEnabled,
    baseNoticesEnabled,
    shieldCounterEnabled,
    slowResistanceShown: false,
    splitShown: false,
    shieldCounterShown: false,
    activeNotice: null,
    noticeEndsAt: null,
  };
}

export function updateTraitNoticeState(
  state: TraitNoticeState,
  events: readonly EnemyTraitVisualEvent[],
  elapsedSeconds: number,
): TraitNoticeState {
  if (!state.enabled) return state;
  const now = safeTime(elapsedSeconds);
  if (state.noticeEndsAt !== null && now < state.noticeEndsAt) return state;

  if (
    state.shieldCounterEnabled
    && !state.shieldCounterShown
    && events.some(({ kind }) => kind === 'shield-open')
  ) {
    return {
      ...state,
      shieldCounterShown: true,
      activeNotice: 'shield-counter',
      noticeEndsAt: now + SLOW_RESIST_NOTICE_DURATION_SECONDS,
    };
  }
  if (
    state.baseNoticesEnabled
    && !state.splitShown
    && events.some(({ kind }) => kind === 'split-open')
  ) {
    return {
      ...state,
      splitShown: true,
      activeNotice: 'split',
      noticeEndsAt: now + SLOW_RESIST_NOTICE_DURATION_SECONDS,
    };
  }
  if (
    state.baseNoticesEnabled
    && !state.slowResistanceShown
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
    !state.enabled
    || state.activeNotice === null
    || state.noticeEndsAt === null
    || safeTime(elapsedSeconds) >= state.noticeEndsAt
  ) return null;
  if (state.activeNotice === 'split') return SPLIT_VIEW;
  if (state.activeNotice === 'shield-counter') return SHIELD_COUNTER_VIEW;
  return SLOW_RESISTANCE_VIEW;
}
