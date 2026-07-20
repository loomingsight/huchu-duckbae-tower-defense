export type ListenerTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

export class LifecycleScope {
  private cleanups: Array<() => void> = [];
  private isDisposed = false;

  get disposed(): boolean {
    return this.isDisposed;
  }

  add(cleanup: () => void): void {
    if (this.isDisposed) {
      cleanup();
      return;
    }
    this.cleanups.push(cleanup);
  }

  listen(
    target: ListenerTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener, options);
    this.add(() => target.removeEventListener(type, listener, options));
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    for (const cleanup of this.cleanups.reverse()) {
      try {
        cleanup();
      } catch {
        // Continue releasing the remaining resources after one cleanup failure.
      }
    }
    this.cleanups = [];
  }
}

export async function guardInitialization<T>(
  scope: LifecycleScope,
  initialize: () => Promise<T>,
): Promise<T> {
  try {
    return await initialize();
  } catch (error) {
    scope.dispose();
    throw error;
  }
}
