import type { CSSProperties } from 'react';
import { CATEGORIES, MIX_CATEGORY, CUSTOM_COLOR, type PoolId } from '../content/categories.ts';
import { strings } from '../i18n/strings.ts';
import { HowToPlay } from './HowToPlay.tsx';

interface Props {
  onSelect: (pool: PoolId) => void;
  onCustom: () => void;
  isDemo: boolean;
  counts: Record<PoolId, number>;
}

export function CategoryPicker({ onSelect, onCustom, isDemo, counts }: Props) {
  return (
    <main className="screen home" aria-labelledby="home-title">
      <header className="home-header">
        <h1 id="home-title" className="brand" tabIndex={-1} data-autofocus>
          <span aria-hidden="true">🤔 </span>
          {strings.appName}
        </h1>
        <p className="tagline">{strings.tagline}</p>
        {isDemo && (
          <p className="demo-badge">
            <strong>{strings.demoBadge}</strong> · {strings.demoNote}
          </p>
        )}
      </header>

      <ul className="tile-grid" aria-label="Categories">
        {CATEGORIES.map((c) => (
          <li key={c.id}>
            <Tile
              label={c.label}
              emoji={c.emoji}
              blurb={c.blurb}
              color={c.color}
              empty={counts[c.id] === 0}
              onClick={() => onSelect(c.id)}
            />
          </li>
        ))}
      </ul>

      <h2 className="section-label">{strings.mixAndCustom}</h2>
      <ul className="tile-grid tile-grid--wide" aria-label="More ways to play">
        <li>
          <Tile
            label={MIX_CATEGORY.label}
            emoji={MIX_CATEGORY.emoji}
            blurb={MIX_CATEGORY.blurb}
            color={MIX_CATEGORY.color}
            empty={counts.mix === 0}
            onClick={() => onSelect('mix')}
          />
        </li>
        <li>
          <Tile
            label={strings.customLabel}
            emoji="✏️"
            blurb={strings.customBlurb}
            color={CUSTOM_COLOR}
            onClick={onCustom}
          />
        </li>
      </ul>

      <HowToPlay />
    </main>
  );
}

function Tile(props: {
  label: string;
  emoji: string;
  blurb: string;
  color: string;
  empty?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="tile"
      style={{ '--tile-color': props.color } as CSSProperties}
      onClick={props.onClick}
      data-empty={props.empty ? 'true' : undefined}
    >
      <span className="tile-emoji" aria-hidden="true">
        {props.emoji}
      </span>
      <span className="tile-label">{props.label}</span>
      <span className="tile-blurb">{props.blurb}</span>
    </button>
  );
}
