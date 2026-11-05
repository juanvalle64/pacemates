import { Link } from 'react-router';
import { LaneArt, ThemeSwitch, Wordmark } from '../components/Brand.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { stravaHosted } from '../lib/config.ts';
import { useDocumentTitle } from '../lib/theme.ts';

const questions = [
  'Trainiere ich gerade mehr als letzten Monat oder fühlt es sich nur so an?',
  'Bin ich müde, weil die Woche hart war, oder baue ich wirklich auf?',
  'Fehlt mir der lange Lauf, die harte Einheit oder einfach ein ruhiger Tag?',
];

const modules = [
  { title: 'Übersicht', body: 'Stunden, Kilometer, Höhenmeter, Belastung und aktive Tage für 7 Tage bis ein Jahr, getrennt nach Laufen, Rad, Schwimmen und Kombi.' },
  { title: 'Trends', body: 'Zeit, Belastung und Intensität pro Woche, über 90 Tage, ein Jahr oder alles. Du siehst, ob dein Umfang wächst, stagniert oder schwankt.' },
  { title: 'Vergleich', body: 'Diese Woche gegen die letzte, Monat gegen Monat oder zwei Zeiträume, die du selbst setzt. Mit Differenz je Kennzahl.' },
  { title: 'Form & Erholung', body: 'Fitness, Ermüdung und Form aus einem Fitness-Fatigue-Modell. Mit Hinweis, solange die Werte noch nicht stabil sind.' },
  { title: 'Tipps', body: 'Feste Regeln, zum Beispiel für steile Belastungssprünge oder fehlende leichte Tage. Jeder Tipp zeigt die Zahlen, die ihn auslösen.' },
];

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
          <div className="hero-copy">
            <p className="kicker">Ausdauer, aus deinen Daten</p>
            <h1>Sieh, was dein Training wirklich tut.</h1>
            <p className="lead">
              PaceMates liest deine Läufe, Fahrten und Schwimmeinheiten aus Garmin und Strava und zeigt dir Umfang, Intensität, Verlauf, Form und Erholung. Mit Hinweisen, die sagen, aus welcher Zahl sie kommen.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-large" to="/app/daten#dateien">Aktivitäten importieren</Link>
              <a className="btn btn-ghost btn-large" href="#so-gehts">So funktioniert es</a>
            </div>
            <ul className="proof-line" aria-label="Grundsätze">
              <li>Kein Konto</li>
              <li>Keine Beispieldaten</li>
              <li>Daten bleiben im Browser</li>
            </ul>
          </div>
          <LaneArt />
        </section>

        <section className="section problem" aria-labelledby="problem-titel">
          <div className="section-head">
            <p className="kicker">Das Problem</p>
            <h2 id="problem-titel">Viele Zahlen. Wenig Antworten.</h2>
            <p>Uhr und App sammeln jede Einheit. Aber die Fragen, die dich weiterbringen, beantworten sie selten auf einen Blick:</p>
          </div>
          <ul className="question-list">
            {questions.map((question) => <li key={question}>{question}</li>)}
          </ul>
          <p className="section-foot">PaceMates rechnet diese Fragen aus deinen eigenen Einheiten durch. Nicht im Vergleich zu anderen, sondern zu dir selbst von vor ein paar Wochen.</p>
        </section>

        <section className="section" id="so-gehts" aria-labelledby="so-titel">
          <div className="section-head">
            <p className="kicker">In drei Schritten</p>
            <h2 id="so-titel">So funktioniert es</h2>
          </div>
          <ol className="steps">
            <li>
              <span className="step-no" aria-hidden="true">1</span>
              <h3>Daten holen</h3>
              <p>Dateien aus Garmin Connect, Strava oder einer anderen Uhr ablegen: GPX, TCX, FIT, CSV oder ein ganzes ZIP. {stravaHosted ? 'Oder mit Strava verbinden.' : ''} Vor dem Speichern siehst du, was erkannt wurde.</p>
            </li>
            <li>
              <span className="step-no" aria-hidden="true">2</span>
              <h3>Optional: Puls und Schwellen</h3>
              <p>Maximale und Ruhe-Herzfrequenz, FTP oder Schwellenpace machen die Belastung je Einheit genauer. Ohne sie rechnet PaceMates mit der Dauer und sagt das dazu.</p>
            </li>
            <li>
              <span className="step-no" aria-hidden="true">3</span>
              <h3>Lesen und entscheiden</h3>
              <p>Übersicht, Trends, Vergleich, Form und Tipps. Was du daraus machst, entscheidest du.</p>
            </li>
          </ol>
        </section>

        <section className="section" aria-labelledby="module-titel">
          <div className="section-head">
            <p className="kicker">Was du siehst</p>
            <h2 id="module-titel">Fünf Ansichten auf dein Training</h2>
          </div>
          <div className="feature-grid">
            {modules.map((module) => (
              <article key={module.title} className="feature">
                <h3>{module.title}</h3>
                <p>{module.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section model" aria-labelledby="modell-titel">
          <div className="section-head">
            <p className="kicker">Keine Blackbox</p>
            <h2 id="modell-titel">So wird gerechnet</h2>
            <p>Jede Einheit bekommt eine Belastung. PaceMates nimmt das genaueste Verfahren, für das deine Daten reichen:</p>
          </div>
          <ol className="method-list">
            <li><strong>TRIMP</strong> aus Dauer und Herzfrequenzreserve, wenn Puls sowie maximale und Ruhe-Herzfrequenz da sind.</li>
            <li><strong>TSS</strong> aus Leistung und FTP, oder der Wert, der schon in der FIT-Datei steht.</li>
            <li><strong>Pace-Belastung</strong> gegen deine Schwellenpace beim Laufen oder Schwimmen.</li>
            <li><strong>Dauer-Proxy</strong> aus den Minuten, wenn nichts davon da ist. Dann steht das auch so dran.</li>
          </ol>
          <div className="formula" role="group" aria-label="Formeln">
            <p><span>Fitness (CTL)</span><code>42-Tage-Schnitt der Tagesbelastung</code></p>
            <p><span>Ermüdung (ATL)</span><code>7-Tage-Schnitt der Tagesbelastung</code></p>
            <p><span>Form (TSB)</span><code>CTL − ATL vom Vortag</code></p>
          </div>
          <p className="meta">In den ersten sechs Wochen sind die Werte noch nicht stabil, weil die Reihe bei null startet. PaceMates sagt dir das, statt es zu verstecken.</p>
        </section>

        <section className="section" aria-labelledby="quellen-titel">
          <div className="section-head">
            <p className="kicker">Woher die Daten kommen</p>
            <h2 id="quellen-titel">Ohne deine Daten bleibt alles leer.</h2>
            <p>PaceMates legt keine Beispielkurven unter. Was du siehst, stammt aus deinen Einheiten.</p>
          </div>
          <div className="source-grid">
            <article className="source-card">
              <p className="badge badge-ok">Sofort</p>
              <h3>Dateien</h3>
              <p>GPX, TCX, FIT und CSV, einzeln oder als ZIP, auch der komplette Strava- oder Garmin-Export. Funktioniert ohne Konto und ohne Anmeldung.</p>
            </article>
            <article className="source-card">
              <p className="badge">{stravaHosted ? 'Login' : 'Eigene API-App'}</p>
              <h3>Strava</h3>
              <p>{stravaHosted
                ? 'Mit Strava anmelden, Lesezugriff erlauben, Aktivitäten holen. Spätere Abgleiche holen nur Neues. Doppelte Einheiten aus Datei und Strava werden zusammengeführt.'
                : 'Mit einer eigenen Strava-API-Anwendung, die du in fünf Minuten anlegst. Oder über den Strava-Datenexport als Datei.'}</p>
            </article>
            <article className="source-card">
              <p className="badge">Export</p>
              <h3>Garmin</h3>
              <p>Export aus Garmin Connect als FIT, GPX oder TCX. Einen Garmin-Login gibt es nicht, weil Garmins Schnittstelle nur für freigegebene Partner offen ist.</p>
            </article>
          </div>
        </section>

        <section className="privacy-band" aria-labelledby="privat-titel">
          <h2 id="privat-titel">Deine Einheiten bleiben auf deinem Gerät.</h2>
          <p>PaceMates hat keine Datenbank mit deinen Aktivitäten. Dateien werden im Browser gelesen, nicht hochgeladen. Das heißt auch: Ein anderes Gerät sieht deine Daten nicht automatisch. Dafür gibt es die Sicherung als Datei.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/app/daten#dateien">Erste Datei importieren</Link>
            <Link className="btn btn-ghost" to="/datenschutz">Datenschutz lesen</Link>
          </div>
        </section>

        <section className="section faq" aria-labelledby="faq-titel">
          <div className="section-head">
            <p className="kicker">Fragen</p>
            <h2 id="faq-titel">Was du vorher wissen solltest</h2>
          </div>
          <details>
            <summary>Brauche ich einen Pulsgurt oder Leistungsmesser?</summary>
            <p>Nein. Ohne Puls oder Leistung rechnet PaceMates die Belastung aus der Dauer. Dann ist ein harter Intervalllauf so viel wert wie ein lockerer gleicher Länge. PaceMates zeigt dir, wie groß dieser Anteil ist.</p>
          </details>
          <details>
            <summary>Was passiert, wenn ich Handy oder Browser wechsle?</summary>
            <p>Die Daten kommen nicht automatisch mit, weil es kein Konto gibt. Lade unter Daten eine Sicherung herunter und spiel sie auf dem neuen Gerät ein. Oder importiere dort neu.</p>
          </details>
          <details>
            <summary>Vergleicht PaceMates mich mit anderen?</summary>
            <p>Nein. Es gibt kein Ranking und keine Bestenliste. Alle Werte beziehen sich nur auf deine eigenen Einheiten.</p>
          </details>
          <details>
            <summary>Sind die Tipps medizinische Beratung?</summary>
            <p>Nein. Die Tipps folgen festen trainingsmethodischen Regeln auf deinen berechneten Werten. Sie wissen nichts über Schlaf, Krankheit oder Verletzungen und ersetzen keine Trainerin, keinen Trainer und keine Ärztin.</p>
          </details>
          <details>
            <summary>Warum gibt es keinen Garmin-Login?</summary>
            <p>Die offizielle Garmin-Schnittstelle ist nur für Unternehmen im Garmin-Partnerprogramm zugänglich. PaceMates ist kein solcher Partner. Der Export aus Garmin Connect liefert dieselben Aktivitäten als Datei.</p>
          </details>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
