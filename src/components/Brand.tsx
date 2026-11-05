import { Link } from 'react-router';
import { useTheme, type ThemeChoice } from '../lib/theme.ts';

/** Bildmarke: eine Laufbahn von oben, mit Startlinie. Steht für Ausdauer, Rhythmus, Runden. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" aria-hidden="true">
      <rect x="2" y="3" width="44" height="26" rx="13" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="9" y="10" width="30" height="12" rx="6" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
      <path d="M30 3v7" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
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
 * Bahnlinien: das grafische Motiv der Marke. Kein Diagramm, keine Werte.
 * Die drei Bahnen stehen für das, was PaceMates auseinanderhält: Umfang, Intensität, Erholung.
 */
export function LaneArt() {
  const lanes = ['Umfang', 'Intensität', 'Erholung'];
  const offsets = [0, 34, 68, 102];
  return (
    <svg className="lane-art" viewBox="0 0 420 300" aria-hidden="true">
      <rect width="420" height="300" rx="12" className="lane-ground" />
      {offsets.map((d) => (
        <rect key={d} x={-200 + d} y={20 + d} width={580 - 2 * d} height={260 - 2 * d} rx={130 - d} className="lane-line" />
      ))}
      {lanes.map((label, index) => {
        const y = 195 + index * 34 + 6;
        return (
          <g key={label}>
            <text className="lane-no" x="24" y={y}>{index + 1}</text>
            <text className="lane-label" x="48" y={y}>{label}</text>
          </g>
        );
      })}
      <path d="M178 178V280" className="lane-start" />
      <path d="M178 20V122" className="lane-start lane-start-faint" />
    </svg>
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
