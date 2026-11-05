import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
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
  const { profile, updateProfile } = useAthlete();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const shownName = nameDraft ?? profile.name;
  return (
    <div className="shell">
      <a className="skip" href="#inhalt">Zum Inhalt</a>
      <header className="topbar">
        <Wordmark to="/app" />
        <div className="topbar-actions">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              updateProfile({ name: shownName.trim() });
              setNameDraft(null);
            }}
          >
            <label className="name-field">
              <span className="sr-only">Name</span>
              <input
                value={shownName}
                maxLength={40}
                placeholder="Name, nur lokal"
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
          </NavLink>
        ))}
      </nav>
      <main id="inhalt" className="page">
        <Outlet />
        <p className="footnote">Aktivitäten bleiben in diesem Browser.</p>
      </main>
    </div>
  );
}
