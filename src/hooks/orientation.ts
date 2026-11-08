/**
 * Landscape is the main play format: the phone sits sideways on the forehead.
 * Where the browser allows it (Android Chrome & co., which require fullscreen
 * first), Start enters fullscreen and freezes the current landscape orientation so
 * the screen does not flip while the phone is tilted on a forehead. iOS Safari has
 * no orientation lock; there the "rotate your phone" hint is all we can do.
 * Every step is best-effort and never throws.
 */
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape' | 'landscape-primary' | 'landscape-secondary') => Promise<void>;
};

function orientation(): LockableOrientation | undefined {
  return typeof screen === 'undefined'
    ? undefined
    : (screen.orientation as LockableOrientation | undefined);
}

export async function lockLandscape(): Promise<boolean> {
  const o = orientation();
  if (!o || typeof o.lock !== 'function') return false;
  try {
    const root = document.documentElement;
    if (!document.fullscreenElement && document.fullscreenEnabled && root.requestFullscreen)
      await root.requestFullscreen({ navigationUI: 'hide' });
    // Keep whichever landscape side the player already holds; otherwise any landscape.
    const current = o.type?.startsWith('landscape') ? o.type : 'landscape';
    await o.lock(current as 'landscape');
    return true;
  } catch {
    return false;
  }
}

export function unlockOrientation() {
  try {
    orientation()?.unlock?.();
  } catch {
    /* not locked */
  }
}
