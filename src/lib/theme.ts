import { useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const THEME_KEY = 'pacemates.theme';

function readTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === 'light' || value === 'dark') return value;
  } catch {
    /* Systemdarstellung bleibt. */
  }
  return 'system';
}

export function applyTheme(theme: ThemeChoice): void {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* Die Wahl gilt dann nur für diesen Seitenaufruf. */
  }
}

export function useTheme(): [ThemeChoice, (theme: ThemeChoice) => void] {
  const [theme, setTheme] = useState<ThemeChoice>(() => readTheme());
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  return [theme, setTheme];
}

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title === 'PaceMates' ? title : `${title} · PaceMates`;
  }, [title]);
}
