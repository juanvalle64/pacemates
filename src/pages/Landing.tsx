import { Link } from 'react-router';
import { ThemeSwitch, TrackArt, Wordmark } from '../components/Brand.tsx';
import { useDocumentTitle } from '../lib/theme.ts';

export function Landing() {
  useDocumentTitle('PaceMates');
  return (
    <div className="landing">
      <a className="skip" href="#inhalt">Zum Inhalt</a>
      <header className="topbar">
        <Wordmark to="/" />
        <div className="topbar-actions">
          <ThemeSwitch />
          <Link className="btn btn-primary" to="/app">App öffnen</Link>
        </div>
      </header>
      <main id="inhalt">
        <section className="hero">
          <div>
            <p className="kicker">Ausdauer, aus deinen Daten</p>
            <h1>Sieh, was dein Training wirklich tut.</h1>
            <p className="lead">
              PaceMates liest Läufe, Fahrten und Schwimmeinheiten und zeigt Umfang, Intensität, Verlauf, Form und Erholung.
              Gerechnet wird nur mit dem, was du importierst oder von Strava holst.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/app">Zur Übersicht</Link>
              <Link className="btn btn-ghost" to="/app/daten">Aktivitäten importieren</Link>
            </div>
            <ul className="sport-pills">
              <li>Laufen</li>
              <li>Radfahren</li>
              <li>Schwimmen</li>
              <li>Triathlon</li>
            </ul>
          </div>
          <TrackArt />
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Für dein eigenes Training</h2>
            <p>Für Leute, die ausdauernd unterwegs sind und ihre eigenen Zahlen lesen wollen. Es gibt keinen Vergleich mit anderen.</p>
          </div>
          <div className="feature-grid">
            <article className="feature">
              <h3>Überblick und Verlauf</h3>
              <p>Stunden, Kilometer, Belastung und Wochen, aufgebaut aus den importierten Einheiten.</p>
            </article>
            <article className="feature">
              <h3>Zwei Zeiträume</h3>
              <p>Diese Woche gegen die letzte, Monat gegen Monat, oder zwei Bereiche, die du selbst setzt.</p>
            </article>
            <article className="feature">
              <h3>Form und Hinweise</h3>
              <p>Fitness, Ermüdung und Form aus einem Fitness-Fatigue-Modell. Hinweise nur aus diesen Werten, mit der Zahl, die sie auslöst.</p>
            </article>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Wo die Daten herkommen</h2>
            <p>Ohne Datei oder Strava-Sync bleibt die Auswertung leer. PaceMates legt keine Beispieldaten darunter.</p>
          </div>
          <div className="source-grid">
            <article className="source-card">
              <h3>Dateien</h3>
              <p>GPX, TCX, FIT und CSV, auch mehrere auf einmal und als ZIP. Das ist der Weg, der ohne Konto funktioniert.</p>
            </article>
            <article className="source-card">
              <h3>Strava</h3>
              <p>OAuth mit PKCE, sobald du eine Strava-API-Anwendung anlegst und die Client-ID hier einträgst. Ohne diese ID startet kein Login.</p>
            </article>
            <article className="source-card">
              <h3>Garmin</h3>
              <p>Export als FIT, GPX oder TCX. Die offizielle Schnittstelle ist partnerbeschränkt und in dieser Version nicht angebunden.</p>
            </article>
          </div>
        </section>

        <section className="privacy-band">
          <h2>Die Aktivitäten bleiben hier.</h2>
          <p>PaceMates hat keinen Server, der deine Einheiten sieht. Der Browser speichert sie lokal. Löschen kannst du sie in den Datenquellen.</p>
          <Link className="btn btn-primary" to="/app/daten">Datenquellen öffnen</Link>
        </section>
      </main>
      <footer className="site-footer">
        <span>PaceMates</span>
        <span>Kein Konto. Keine Beispieldaten. Kein Ranking gegen andere.</span>
      </footer>
    </div>
  );
}
