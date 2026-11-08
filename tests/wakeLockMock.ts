import { vi } from 'vitest';

export class FakeSentinel extends EventTarget {
  released = false;
  readonly type = 'screen';
  release = vi.fn(async () => {
    if (this.released) return;
    this.released = true;
    this.dispatchEvent(new Event('release'));
  });
  /** Simulates the browser revoking the lock (e.g. tab hidden, battery saver). */
  revoke() {
    this.released = true;
    this.dispatchEvent(new Event('release'));
  }
}

export function installWakeLock(impl?: () => Promise<FakeSentinel>) {
  const sentinels: FakeSentinel[] = [];
  const request = vi.fn(
    impl ??
      (async () => {
        const s = new FakeSentinel();
        sentinels.push(s);
        return s;
      }),
  );
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
  return { request, sentinels };
}

export function removeWakeLock() {
  // jsdom has no wakeLock; make sure a previous test's mock is gone.
  delete (navigator as unknown as Record<string, unknown>).wakeLock;
}

let visibility: DocumentVisibilityState = 'visible';
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
Object.defineProperty(document, 'hidden', {
  configurable: true,
  get: () => visibility === 'hidden',
});

export function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  document.dispatchEvent(new Event('visibilitychange'));
}
