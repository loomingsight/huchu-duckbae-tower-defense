export const BASE_HIT_SHAKE_CLASS = 'game-shell--base-hit';
export const BASE_HIT_SHAKE_DURATION_MS = 420;
export const BASE_HIT_SHAKE_CLEANUP_MS = 460;

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

export type BaseHitFeedbackTarget = Readonly<{
  classList: Readonly<{
    add(name: string): void;
    remove(name: string): void;
  }>;
  offsetWidth: number;
}>;

export type BaseHitFeedbackTimers = Readonly<{
  setTimeout(callback: () => void, delayMs: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}>;

export type BaseHitFeedback = Readonly<{
  trigger(): void;
  clear(): void;
  destroy(): void;
}>;

export function createBaseHitFeedback(
  target: BaseHitFeedbackTarget,
  timers: BaseHitFeedbackTimers = globalThis,
): BaseHitFeedback {
  let timer: TimerHandle | null = null;

  function clear(): void {
    if (timer !== null) {
      timers.clearTimeout(timer);
      timer = null;
    }
    target.classList.remove(BASE_HIT_SHAKE_CLASS);
  }

  function trigger(): void {
    clear();
    void target.offsetWidth;
    target.classList.add(BASE_HIT_SHAKE_CLASS);
    timer = timers.setTimeout(clear, BASE_HIT_SHAKE_CLEANUP_MS);
  }

  return { trigger, clear, destroy: clear };
}
