import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCountdown } from '../src/hooks/useCountdown.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useCountdown', () => {
  it('shows 5..1, never 0, and completes exactly once at 5s', () => {
    const onComplete = vi.fn();
    const seen = new Set<number>();
    const { result } = renderHook(() =>
      useCountdown({ durationMs: 5000, onComplete, now: () => Date.now() }),
    );
    for (let t = 0; t < 4990; t += 10) {
      seen.add(result.current.secondsLeft);
      act(() => void vi.advanceTimersByTime(10));
    }
    expect([...seen]).toEqual([5, 4, 3, 2, 1]);
    expect(onComplete).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(100));
    expect(onComplete).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(10000));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('uses the clock, not tick counts (late timers do not drift)', () => {
    const onComplete = vi.fn();
    let clock = 0;
    const { result } = renderHook(() =>
      useCountdown({ durationMs: 5000, onComplete, now: () => clock }),
    );
    clock = 3500; // e.g. main thread was blocked
    act(() => void vi.advanceTimersByTime(1100));
    expect(result.current.secondsLeft).toBe(2);
    clock = 5000;
    act(() => void vi.advanceTimersByTime(1100));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('stops on unmount (cancel) without completing', () => {
    const onComplete = vi.fn();
    const { unmount } = renderHook(() =>
      useCountdown({ durationMs: 5000, onComplete, now: () => Date.now() }),
    );
    act(() => void vi.advanceTimersByTime(2000));
    unmount();
    act(() => void vi.advanceTimersByTime(10000));
    expect(onComplete).not.toHaveBeenCalled();
  });
});
