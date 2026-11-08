import { useCallback, useEffect, useRef, useState } from 'react';

export type WakeLockStatus = 'unsupported' | 'requesting' | 'active' | 'denied' | 'released';

interface Sentinel extends EventTarget {
  readonly released: boolean;
  release(): Promise<void>;
}
interface WakeLockApi {
  request(type: 'screen'): Promise<Sentinel>;
}

function getApi(): WakeLockApi | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
  return api && typeof api.request === 'function' ? api : undefined;
}

const isVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

/**
 * Best-effort Screen Wake Lock (https://developer.mozilla.org/docs/Web/API/Screen_Wake_Lock_API).
 *
 * - `requestFromGesture()` should be called from the Start/Next tap: some browsers
 *   only grant the lock in response to user activation.
 * - While `enabled`, the lock is re-acquired when the page becomes visible again
 *   (browsers release it automatically on hide).
 * - When `enabled` turns false or the component unmounts, the lock is released
 *   and never re-acquired.
 * - Concurrent requests are coalesced; rejections never escape as unhandled.
 * - No video/no-sleep hacks. Unsupported and denied are reported separately.
 */
export function useScreenWakeLock(enabled: boolean) {
  const [status, setStatus] = useState<WakeLockStatus>(() =>
    getApi() ? 'released' : 'unsupported',
  );
  const sentinelRef = useRef<Sentinel | null>(null);
  const pendingRef = useRef<Promise<void> | null>(null);
  /** True between a play gesture and End/unmount: we want the lock. */
  const wantRef = useRef(false);
  const mountedRef = useRef(true);

  const update = useCallback((next: WakeLockStatus) => {
    if (mountedRef.current) setStatus(next);
  }, []);

  const acquire = useCallback((): Promise<void> => {
    const api = getApi();
    if (!api) {
      update('unsupported');
      return Promise.resolve();
    }
    if (sentinelRef.current && !sentinelRef.current.released) return Promise.resolve();
    if (pendingRef.current) return pendingRef.current;
    if (!isVisible()) return Promise.resolve();

    update('requesting');
    const pending = api
      .request('screen')
      .then((sentinel) => {
        if (!wantRef.current) {
          // Play ended while the request was in flight.
          sentinel.release().catch(() => undefined);
          update('released');
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
          update('released');
        });
        update('active');
      })
      .catch(() => {
        // NotAllowedError (policy, battery saver, no user activation...) or any failure.
        update('denied');
      })
      .finally(() => {
        pendingRef.current = null;
      });
    pendingRef.current = pending;
    return pending;
  }, [update]);

  const release = useCallback(async () => {
    wantRef.current = false;
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    if (sentinel && !sentinel.released) {
      try {
        await sentinel.release();
      } catch {
        /* already released */
      }
    }
    if (getApi()) update('released');
  }, [update]);

  const requestFromGesture = useCallback(() => {
    wantRef.current = true;
    return acquire();
  }, [acquire]);

  useEffect(() => {
    if (enabled) {
      wantRef.current = true;
      void acquire();
    } else if (wantRef.current || sentinelRef.current) {
      void release();
    }
  }, [enabled, acquire, release]);

  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (isVisible() && wantRef.current) void acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, acquire]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      wantRef.current = false;
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      sentinel?.release().catch(() => undefined);
    };
  }, []);

  return { status, requestFromGesture, release };
}
