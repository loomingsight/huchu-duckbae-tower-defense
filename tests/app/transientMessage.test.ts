import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  TRANSIENT_MESSAGE_DURATION_MS,
  createTransientMessageController,
} from '../../src/app/transientMessage';

afterEach(() => {
  vi.useRealTimers();
});

describe('transient placement messages', () => {
  it('hides the latest message after exactly three seconds', () => {
    vi.useFakeTimers();
    const target = { textContent: '', hidden: true };
    const controller = createTransientMessageController(target);

    controller.show('타워를 선택해 주세요.');
    vi.advanceTimersByTime(TRANSIENT_MESSAGE_DURATION_MS - 1);

    expect(target).toEqual({
      textContent: '타워를 선택해 주세요.',
      hidden: false,
    });

    vi.advanceTimersByTime(1);

    expect(target).toEqual({ textContent: '', hidden: true });
  });

  it('restarts expiry for a newer message', () => {
    vi.useFakeTimers();
    const target = { textContent: '', hidden: true };
    const controller = createTransientMessageController(target);

    controller.show('첫 메시지');
    vi.advanceTimersByTime(2000);
    controller.show('두 번째 메시지');
    vi.advanceTimersByTime(1000);

    expect(target).toEqual({ textContent: '두 번째 메시지', hidden: false });

    vi.advanceTimersByTime(2000);

    expect(target).toEqual({ textContent: '', hidden: true });
  });

  it('clears the message and pending expiry when destroyed', () => {
    vi.useFakeTimers();
    const target = { textContent: '', hidden: true };
    const controller = createTransientMessageController(target);

    controller.show('사라질 메시지');
    controller.destroy();
    vi.advanceTimersByTime(TRANSIENT_MESSAGE_DURATION_MS);

    expect(target).toEqual({ textContent: '', hidden: true });
    expect(vi.getTimerCount()).toBe(0);
  });
});
