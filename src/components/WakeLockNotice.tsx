import type { WakeLockStatus } from '../hooks/useScreenWakeLock.ts';
import { useStrings } from '../i18n/language.ts';

/** Subtle fallback message when the screen may still auto-lock. */
export function WakeLockNotice({ status }: { status: WakeLockStatus }) {
  const strings = useStrings();
  if (status !== 'unsupported' && status !== 'denied' && status !== 'released') return null;
  return (
    <p className="wake-notice" role="status" data-status={status}>
      <span aria-hidden="true">🔅 </span>
      {strings.wakeLockWarning}
    </p>
  );
}
