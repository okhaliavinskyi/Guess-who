import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { BANK_STATUS } from '../content/bankStatus.ts';
import { CATEGORY_IDS, CUSTOM_COLOR, getPoolConfig, type PoolId } from '../content/categories.ts';
import { buildPool, getDefaultBank, localizedName, type CharacterBank } from '../content/loader.ts';
import { loadBags, loadSeen, saveBags, saveSeen } from '../game/sessionBags.ts';
import type { Rng } from '../game/shuffleBag.ts';
import { createGameReducer, initialGameState, isPlaying } from '../game/stateMachine.ts';
import { useFullscreen } from '../hooks/useFullscreen.ts';
import { useScreenWakeLock } from '../hooks/useScreenWakeLock.ts';
import { LanguageProvider } from '../i18n/LanguageProvider.tsx';
import { useLanguage } from '../i18n/language.ts';
import type { Lang } from '../i18n/strings.ts';
import { CategoryPicker } from '../components/CategoryPicker.tsx';
import { Countdown } from '../components/Countdown.tsx';
import { CustomWordForm } from '../components/CustomWordForm.tsx';
import { ReadyScreen } from '../components/ReadyScreen.tsx';
import { RevealScreen } from '../components/RevealScreen.tsx';
import { UnavailableScreen } from '../components/UnavailableScreen.tsx';

export const COUNTDOWN_MS = 5000;
const POOL_IDS: readonly PoolId[] = [...CATEGORY_IDS, 'mix'];

export interface AppProps {
  bank?: CharacterBank;
  rng?: Rng;
  /** Monotonic clock for the countdown (tests). */
  now?: () => number;
  countdownMs?: number;
  /** Treat bank as demo content (defaults to BANK_STATUS). */
  isDemo?: boolean;
  /** Start in this UI language instead of the saved/browser one (tests). */
  lang?: Lang;
}

export function App({ lang, ...props }: AppProps) {
  return (
    <LanguageProvider initial={lang}>
      <Game {...props} />
    </LanguageProvider>
  );
}

function Game({
  bank = getDefaultBank(),
  rng,
  now,
  countdownMs = COUNTDOWN_MS,
  isDemo = BANK_STATUS === 'demo',
}: Omit<AppProps, 'lang'>) {
  const { lang, strings } = useLanguage();
  const pools = useMemo(
    () =>
      Object.fromEntries(POOL_IDS.map((p) => [p, buildPool(bank, p)])) as Record<PoolId, string[]>,
    [bank],
  );
  const counts = useMemo(
    () => Object.fromEntries(POOL_IDS.map((p) => [p, pools[p].length])) as Record<PoolId, number>,
    [pools],
  );
  const reducer = useMemo(() => createGameReducer({ getPool: (p) => pools[p], rng }), [pools, rng]);
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialGameState(loadBags(), loadSeen()),
  );
  const { screen } = state;
  const playing = isPlaying(screen.phase);
  const wakeLock = useScreenWakeLock(playing);
  const fullscreen = useFullscreen();
  const [photoFailedRound, setPhotoFailedRound] = useState<number | null>(null);

  useEffect(() => saveBags(state.bags), [state.bags]);
  useEffect(() => saveSeen(state.seen), [state.seen]);

  // Backgrounding during the countdown cancels it: never reveal (or skip) unseen.
  useEffect(() => {
    if (screen.phase !== 'COUNTDOWN') return;
    const interrupt = () => {
      if (document.visibilityState === 'hidden') dispatch({ type: 'INTERRUPT' });
    };
    const onPageHide = () => dispatch({ type: 'INTERRUPT' });
    interrupt();
    document.addEventListener('visibilitychange', interrupt);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', interrupt);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [screen.phase]);

  // Move focus to each new screen's heading for keyboard and screen-reader users.
  useEffect(() => {
    if (screen.phase === 'REVEALED') return; // the card focuses its own heading
    const target = document.querySelector<HTMLElement>('[data-autofocus]');
    target?.focus({ preventScroll: true });
  }, [screen.phase]);

  const start = useCallback(() => {
    void wakeLock.requestFromGesture();
    dispatch({ type: 'START' });
  }, [wakeLock]);

  const goHome = useCallback(
    (type: 'END' | 'CHANGE_CATEGORY' | 'BACK') => {
      dispatch({ type });
      if (type === 'END') void fullscreen.exit();
    },
    [fullscreen],
  );

  switch (screen.phase) {
    case 'HOME':
      return (
        <CategoryPicker
          isDemo={isDemo}
          counts={counts}
          onSelect={(pool) => dispatch({ type: 'SELECT_POOL', pool })}
          onCustom={() => dispatch({ type: 'OPEN_CUSTOM' })}
        />
      );

    case 'CUSTOM_INPUT':
      return (
        <CustomWordForm
          onBack={() => goHome('BACK')}
          onSubmit={(word) => {
            void wakeLock.requestFromGesture();
            dispatch({ type: 'SUBMIT_CUSTOM', word });
          }}
        />
      );

    case 'UNAVAILABLE':
      return (
        <UnavailableScreen
          title={strings.categories[screen.pool].label}
          onBack={() => goHome('BACK')}
        />
      );

    case 'READY': {
      const { selection } = screen;
      const config = selection.kind === 'pool' ? getPoolConfig(selection.pool) : null;
      return (
        <ReadyScreen
          title={
            selection.kind === 'pool'
              ? strings.categories[selection.pool].label
              : strings.customTitle
          }
          emoji={config?.emoji ?? '✏️'}
          color={config?.color ?? CUSTOM_COLOR}
          deckSize={selection.kind === 'pool' ? counts[selection.pool] : null}
          isDemo={isDemo && selection.kind === 'pool'}
          interrupted={screen.interrupted}
          onStart={start}
          onBack={() => goHome('BACK')}
        />
      );
    }

    case 'COUNTDOWN': {
      const round = screen.round;
      return (
        <Countdown
          key={round}
          durationMs={countdownMs}
          now={now}
          onComplete={() => dispatch({ type: 'COMPLETE', round })}
          onCancel={() => dispatch({ type: 'CANCEL' })}
        />
      );
    }

    case 'REVEALED': {
      const { item, selection } = screen;
      const character = item.kind === 'character' ? bank.byId.get(item.id) : undefined;
      const name =
        item.kind === 'custom' ? item.word : character ? localizedName(character, [lang]) : '';
      const color = selection.kind === 'pool' ? getPoolConfig(selection.pool).color : CUSTOM_COLOR;
      return (
        <RevealScreen
          key={state.round}
          name={name}
          image={character?.image}
          color={color}
          isCustom={item.kind === 'custom'}
          showPhoto={screen.showPhoto}
          photoFailed={photoFailedRound === state.round}
          wakeLockStatus={wakeLock.status}
          onNext={() => {
            void wakeLock.requestFromGesture();
            dispatch({ type: 'NEXT' });
          }}
          onTogglePhoto={() => dispatch({ type: 'TOGGLE_PHOTO' })}
          onPhotoFailed={() => {
            setPhotoFailedRound(state.round);
            if (screen.showPhoto) dispatch({ type: 'TOGGLE_PHOTO' });
          }}
          onChangeCategory={() => goHome('CHANGE_CATEGORY')}
          onEnd={() => goHome('END')}
        />
      );
    }
  }
}
