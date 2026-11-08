import { useCallback, useEffect, useState } from 'react';

/**
 * Optional fullscreen enhancement. Only offered when the Fullscreen API is enabled
 * (iPhone Safari generally isn't); the game never depends on it.
 */
export function useFullscreen() {
  const supported =
    typeof document !== 'undefined' &&
    document.fullscreenEnabled === true &&
    typeof document.documentElement.requestFullscreen === 'function';
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && !!document.fullscreenElement,
  );

  useEffect(() => {
    if (!supported) return;
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [supported]);

  const toggle = useCallback(async () => {
    if (!supported) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      /* user agent refused; ignore — fullscreen is optional */
    }
  }, [supported]);

  const exit = useCallback(async () => {
    if (supported && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
    }
  }, [supported]);

  return { supported, isFullscreen, toggle, exit };
}
