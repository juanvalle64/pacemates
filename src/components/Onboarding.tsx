import { Link } from 'react-router';
import { stravaHosted } from '../lib/config.ts';

/** Erster Start: erklärt, wie Daten reinkommen. Keine Beispielkurven, keine Platzhalterzahlen. */
export function Onboarding() {
  return (
    <section className="onboarding" aria-labelledby="start-titel">
      <h1 id="start-titel" tabIndex={-1}>Hol deine ersten Einheiten rein.</h1>
      <p className="lead-sm">PaceMates rechnet nur mit deinen eigenen Aktivitäten. Solange keine da sind, bleibt jede Auswertung leer. Es gibt keine Beispielkurven.</p>
      <ol className="onboarding-steps">
        <li>
          <span className="step-no" aria-hidden="true">1</span>
          <div>
            <h2>Daten holen</h2>
            <div className="source-pick">
              <Link className="pick" to="/app/daten#dateien">
                <strong>Dateien</strong>
                <span>GPX, TCX, FIT, CSV oder ZIP. Funktioniert sofort.</span>
              </Link>
              <Link className="pick" to="/app/daten#strava">
                <strong>Strava</strong>
                <span>{stravaHosted ? 'Anmelden und Aktivitäten holen.' : 'Mit eigener Strava-API-Anwendung oder über den Datenexport.'}</span>
              </Link>
              <Link className="pick" to="/app/daten#garmin">
                <strong>Garmin</strong>
                <span>Export aus Garmin Connect als FIT, GPX oder TCX.</span>
              </Link>
            </div>
          </div>
        </li>
        <li>
          <span className="step-no" aria-hidden="true">2</span>
          <div>
            <h2>Puls und Schwellen eintragen <em>optional</em></h2>
            <p>Mit maximaler und Ruhe-Herzfrequenz, FTP oder Schwellenpace wird die Belastung je Einheit genauer. Ohne diese Werte rechnet PaceMates mit der Dauer und sagt das dazu.</p>
            <Link to="/app/form#modell">Zu den Eingaben</Link>
          </div>
        </li>
        <li>
          <span className="step-no" aria-hidden="true">3</span>
          <div>
            <h2>Lesen</h2>
            <p>Übersicht, Trends, Vergleich zweier Zeiträume, Form und Erholung, und Tipps mit der Kennzahl, aus der sie kommen.</p>
          </div>
        </li>
      </ol>
      <p className="note">Für Form und Erholung braucht das Modell etwa sechs Wochen Historie. Importiere lieber mehrere Monate auf einmal als nur die letzte Woche.</p>
    </section>
  );
}
