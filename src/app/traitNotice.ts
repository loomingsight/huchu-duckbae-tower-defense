import type { EnemyTraitVisualEvent } from '../game/enemies/enemyTraits';

export const SLOW_RESIST_NOTICE_DURATION_SECONDS = 2.5;

export type TraitNoticeState = Readonly<{
  slowResistanceShown: boolean;
  slowResistanceEndsAt: number | null;
}>;

export type TraitNoticeView = Readonly<{
  title: '흡혈 박쥐 · 둔화 저항';
  body: '슬로우 효과가 50%만 적용돼요';
}>;

const SLOW_RESISTANCE_VIEW: TraitNoticeView = {
  title: '흡혈 박쥐 · 둔화 저항',
  body: '슬로우 효과가 50%만 적용돼요',
};

function safeTime(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function createTraitNoticeState(): TraitNoticeState {
  return {
    slowResistanceShown: false,
    slowResistanceEndsAt: null,
  };
}

export function updateTraitNoticeState(
  state: TraitNoticeState,
  events: readonly EnemyTraitVisualEvent[],
  elapsedSeconds: number,
): TraitNoticeState {
  if (
    state.slowResistanceShown
    || !events.some(({ kind }) => kind === 'slow-resist')
  ) return state;
  return {
    slowResistanceShown: true,
    slowResistanceEndsAt:
      safeTime(elapsedSeconds) + SLOW_RESIST_NOTICE_DURATION_SECONDS,
  };
}

export function traitNoticeView(
  state: TraitNoticeState,
  elapsedSeconds: number,
): TraitNoticeView | null {
  if (
    state.slowResistanceEndsAt === null
    || safeTime(elapsedSeconds) >= state.slowResistanceEndsAt
  ) return null;
  return SLOW_RESISTANCE_VIEW;
}
