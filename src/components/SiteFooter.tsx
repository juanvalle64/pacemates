import { Link } from 'react-router';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <strong className="footer-mark">PaceMates</strong>
        <p>Ausdauer, aus deinen Daten.</p>
      </div>
      <nav aria-label="Rechtliches und Projekt">
        <Link to="/datenschutz">Datenschutz</Link>
        <Link to="/impressum">Impressum</Link>
        <a href="https://github.com/juanvalle64/pacemates" rel="noreferrer">Quellcode</a>
      </nav>
      <p className="meta trademark">Strava ist eine Marke von Strava, Inc. Garmin und Garmin Connect sind Marken von Garmin Ltd. PaceMates ist mit keinem der beiden Unternehmen verbunden.</p>
    </footer>
  );
}
