import { Link } from 'react-router';
import { useTheme, type ThemeChoice } from '../lib/theme.ts';

export function Wordmark({ to }: { to: string }) {
  return (
    <Link to={to} className="wordmark">
      <svg viewBox="0 0 48 32" aria-hidden="true">
        <path d="M14 7h20a9 9 0 0 1 0 18H14a9 9 0 0 1 0-18z" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <path d="M24 7v6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span>PaceMates</span>
    </Link>
  );
}

export function TrackArt() {
  return (
    <svg className="track-art" viewBox="0 0 360 220" aria-hidden="true">
      <path d="M70 40h220a70 70 0 0 1 0 140H70a70 70 0 0 1 0-140z" fill="none" stroke="currentColor" strokeWidth="14" />
      <path d="M118 40h124a46 46 0 0 1 0 92H118" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.45" />
      <path d="M180 40v26" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

const themes: { id: ThemeChoice; label: string }[] = [
  { id: 'system', label: 'System' },
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
