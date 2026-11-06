import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTheme, type ThemeChoice } from '../lib/theme.ts';

/** Bildmarke: eine Startnummer mit vier Nadellöchern und dem Farbband oben. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 24" aria-hidden="true">
      <rect x="1" y="1" width="30" height="22" rx="3" fill="currentColor" />
      <rect x="1" y="1" width="30" height="7" rx="3" className="mark-band" />
      <rect x="1" y="5" width="30" height="3" className="mark-band" />
      <circle cx="5" cy="12" r="1.4" className="mark-pin" />
      <circle cx="27" cy="12" r="1.4" className="mark-pin" />
      <circle cx="5" cy="19" r="1.4" className="mark-pin" />
      <circle cx="27" cy="19" r="1.4" className="mark-pin" />
    </svg>
  );
}

export function Wordmark({ to }: { to: string }) {
  return (
    <Link to={to} className="wordmark" aria-label="PaceMates, zur Startseite">
      <Mark />
      <span>PaceMates</span>
    </Link>
  );
}

/**
 * Die Startnummer als Fläche: Farbband oben, vier Nadellöcher, unten ein
 * perforierter Abschnitt. Sie trägt nur echte Inhalte, nie erfundene Werte.
 */
export function Bib({ band, children, tear, className }: { band: ReactNode; children: ReactNode; tear?: ReactNode; className?: string }) {
  return (
    <div className={className ? `bib ${className}` : 'bib'}>
      <span className="bib-pin bib-pin-bl" aria-hidden="true" />
      <span className="bib-pin bib-pin-br" aria-hidden="true" />
      <div className="bib-band">{band}</div>
      <div className="bib-body">
        <span className="bib-pin bib-pin-tl" aria-hidden="true" />
        <span className="bib-pin bib-pin-tr" aria-hidden="true" />
        {children}
      </div>
      {tear ? <div className="bib-tear">{tear}</div> : null}
    </div>
  );
}

const themes: { id: ThemeChoice; label: string }[] = [
  { id: 'system', label: 'Auto' },
  { id: 'light', label: 'Hell' },
  { id: 'dark', label: 'Dunkel' },
];

export function ThemeSwitch() {
  const [theme, setTheme] = useTheme();
  return (
    <div className="theme" role="radiogroup" aria-label="Darstellung">
      {themes.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={theme === item.id}
          className={theme === item.id ? 'active' : undefined}
          onClick={() => setTheme(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
