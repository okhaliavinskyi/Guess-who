import { useLayoutEffect, useRef } from 'react';

/**
 * Sizes text to the largest font that fits its container (binary search on font
 * size, re-run on resize/rotation). Words wrap normally; only a single word wider
 * than the container at the minimum size is allowed to break. Without layout
 * (jsdom, very old browsers) the CSS clamp() default is kept.
 */
export function useFitText<C extends HTMLElement, T extends HTMLElement>(
  text: string,
  { min = 28, max = 220 }: { min?: number; max?: number } = {},
) {
  const containerRef = useRef<C>(null);
  const textRef = useRef<T>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const el = textRef.current;
    if (!container || !el) return;

    let frame = 0;
    const fit = () => {
      // clientWidth/Height include padding (e.g. the name banner next to a photo).
      const style = getComputedStyle(container);
      const width =
        container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height =
        container.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (width === 0 || height === 0) return;
      el.style.overflowWrap = 'normal';
      const fits = (size: number) => {
        el.style.fontSize = `${size}px`;
        return el.scrollWidth <= width + 1 && el.scrollHeight <= height + 1;
      };
      let lo = min;
      let hi = Math.max(min, Math.min(max, height));
      if (fits(hi)) lo = hi;
      else {
        while (hi - lo > 1) {
          const mid = Math.floor((lo + hi) / 2);
          if (fits(mid)) lo = mid;
          else hi = mid;
        }
      }
      el.style.fontSize = `${lo}px`;
      if (!fits(lo)) el.style.overflowWrap = 'anywhere';
      el.dataset.fitted = 'true';
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };

    fit();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    observer?.observe(container);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    void document.fonts?.ready.then(schedule).catch(() => undefined);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
    };
  }, [text, min, max]);

  return { containerRef, textRef };
}
