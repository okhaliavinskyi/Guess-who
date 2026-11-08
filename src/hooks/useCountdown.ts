import { useEffect, useRef, useState } from 'react';

export interface CountdownOptions {
  durationMs: number;
  onComplete: () => void;
  /** Monotonic clock; injectable for tests. */
  now?: () => number;
}

/**
 * Wall-clock countdown. Elapsed time is always computed from a monotonic clock
 * (performance.now) instead of counting ticks, so throttled or late timers can't
 * drift. Displays N..1 and completes as soon as the duration elapses — "0" is
 * never shown. Mount a fresh instance (e.g. `key={round}`) for each countdown.
 */
export function useCountdown({ durationMs, onComplete, now = defaultNow }: CountdownOptions) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.ceil(durationMs / 1000));
  const onCompleteRef = useRef(onComplete);
  const nowRef = useRef(now);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    nowRef.current = now;
  });

  useEffect(() => {
    const start = nowRef.current();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let done = false;

    const tick = () => {
      const left = durationMs - (nowRef.current() - start);
      if (left <= 0) {
        done = true;
        onCompleteRef.current();
        return;
      }
      const seconds = Math.ceil(left / 1000);
      setSecondsLeft(seconds);
      // Wake up right after the next whole-second boundary (or at the end).
      const untilBoundary = left - (seconds - 1) * 1000;
      timer = setTimeout(tick, Math.max(16, Math.ceil(untilBoundary)));
    };

    tick();
    return () => {
      if (!done && timer !== undefined) clearTimeout(timer);
    };
  }, [durationMs]);

  return { secondsLeft, totalSeconds: Math.ceil(durationMs / 1000) };
}

function defaultNow() {
  return performance.now();
}
