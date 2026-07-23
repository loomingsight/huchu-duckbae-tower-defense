export const TRANSIENT_MESSAGE_DURATION_MS = 3000;

export type TransientMessageTarget = {
  textContent: string | null;
  hidden: boolean;
};

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

export type TransientMessageTimers = Readonly<{
  setTimeout(callback: () => void, delayMs: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}>;

export type TransientMessageController = Readonly<{
  show(message: string): void;
  clear(): void;
  destroy(): void;
}>;

export function createTransientMessageController(
  target: TransientMessageTarget,
  timers: TransientMessageTimers = globalThis,
): TransientMessageController {
  let timer: TimerHandle | null = null;

  function cancelTimer(): void {
    if (timer === null) return;
    timers.clearTimeout(timer);
    timer = null;
  }

  function clear(): void {
    cancelTimer();
    target.textContent = '';
    target.hidden = true;
  }

  function show(message: string): void {
    cancelTimer();
    if (message === '') {
      clear();
      return;
    }
    target.textContent = message;
    target.hidden = false;
    timer = timers.setTimeout(clear, TRANSIENT_MESSAGE_DURATION_MS);
  }

  return { show, clear, destroy: clear };
}
