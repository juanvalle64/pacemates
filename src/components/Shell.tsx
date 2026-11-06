import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { useRouteFocus } from '../lib/route-focus.ts';
import { useAthlete } from '../context/athlete-state.ts';
import { ThemeSwitch, Wordmark } from './Brand.tsx';

const tabs = [
  { to: '/app', label: 'Übersicht', end: true },
  { to: '/app/trends', label: 'Trends', end: false },
  { to: '/app/vergleich', label: 'Vergleich', end: false },
  { to: '/app/form', label: 'Form', end: false },
  { to: '/app/tipps', label: 'Tipps', end: false },
  { to: '/app/daten', label: 'Daten', end: false },
];

export function Shell() {
  const { profile, updateProfile, activities, ready } = useAthlete();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const shownName = nameDraft ?? profile.name;
  useRouteFocus();
  return (
    <div className="shell">
      <a className="skip" href="#inhalt">Zum Inhalt</a>
      <div className="app-head">
      <header className="topbar">
        <Wordmark to="/" />
        <div className="topbar-actions">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              updateProfile({ name: shownName.trim() });
              setNameDraft(null);
            }}
          >
            <label className="name-field">
              <span className="sr-only">Dein Name, bleibt in diesem Browser</span>
              <input
                value={shownName}
                maxLength={40}
                placeholder="Dein Name (optional)"
                autoComplete="given-name"
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={(event) => {
                  updateProfile({ name: event.target.value.trim() });
                  setNameDraft(null);
                }}
              />
            </label>
          </form>
          <ThemeSwitch />
        </div>
      </header>
      <nav className="tabbar" aria-label="Bereiche">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
            {tab.label}
            {tab.to === '/app/daten' && ready && activities.length === 0 ? <span className="tab-dot" aria-label="Noch keine Daten" /> : null}
          </NavLink>
        ))}
      </nav>
      </div>
      <main id="inhalt" className="page">
        <Outlet />
      </main>
      <footer className="app-footer">
        <span>Deine Aktivitäten liegen nur in diesem Browser.</span>
        <nav aria-label="Rechtliches">
          <Link to="/datenschutz">Datenschutz</Link>
          <Link to="/impressum">Impressum</Link>
        </nav>
      </footer>
    </div>
  );
}
