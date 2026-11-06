import { ArrowDown, ArrowRight, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Bib, ThemeSwitch, Wordmark } from '../components/Brand.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { stravaHosted } from '../lib/config.ts';
import { useDocumentTitle } from '../lib/theme.ts';

const questions = [
  'Trainiere ich gerade mehr als letzten Monat oder fühlt es sich nur so an?',
  'Bin ich müde, weil die Woche hart war, oder baue ich wirklich auf?',
  'Fehlt mir der lange Lauf, die harte Einheit oder einfach ein ruhiger Tag?',
];

const views = [
  { title: 'Übersicht', body: 'Stunden, Kilometer, Höhenmeter, Belastung und aktive Tage für 7 Tage bis ein Jahr, getrennt nach Laufen, Rad, Schwimmen und Kombi.' },
  { title: 'Trends', body: 'Zeit, Belastung und Intensität pro Woche, über 90 Tage, ein Jahr oder alles. Du siehst, ob dein Umfang wächst, stagniert oder schwankt.' },
  { title: 'Vergleich', body: 'Diese Woche gegen die letzte, Monat gegen Monat oder zwei Zeiträume, die du selbst setzt. Mit Differenz je Kennzahl.' },
  { title: 'Form & Erholung', body: 'Fitness, Ermüdung und Form aus einem Fitness-Fatigue-Modell. Mit Hinweis, solange die Werte noch nicht stabil sind.' },
  { title: 'Tipps', body: 'Feste Regeln, zum Beispiel für steile Belastungssprünge oder fehlende leichte Tage. Jeder Tipp zeigt die Zahlen, die ihn auslösen.' },
];

/** Das Ablagefeld auf der Startnummer. Dateien gehen direkt in die Import-Vorschau. */
function HeroDrop() {
  const navigate = useNavigate();
  const [over, setOver] = useState(false);
  const send = (files: File[]) => {
    if (files.length > 0) navigate('/app/daten', { state: { files } });
  };
  return (
    <label
      className={over ? 'hero-drop over' : 'hero-drop'}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        send([...event.dataTransfer.files]);
      }}
    >
      <input
        type="file"
        multiple
        accept=".gpx,.tcx,.fit,.csv,.zip,.gz,.json,application/gpx+xml"
        onChange={(event) => send([...(event.target.files ?? [])])}
      />
      <span className="hero-drop-icon" aria-hidden="true"><Upload size={20} strokeWidth={2.2} /></span>
      <span className="hero-drop-text">
        <strong>Aktivitäten importieren</strong>
        <span>GPX, TCX, FIT, CSV oder ZIP auswählen oder hier ablegen</span>
      </span>
    </label>
  );
}

export function Landing() {
  useDocumentTitle('PaceMates');
  return (
    <div className="landing">
      <a className="skip" href="#inhalt">Zum Inhalt</a>
      <div className="hero-field">
        <header className="topbar topbar-on-field">
          <Wordmark to="/" />
          <div className="topbar-actions">
            <ThemeSwitch />
            <Link className="btn btn-on-field" to="/app">App öffnen</Link>
          </div>
        </header>
        <section className="hero" id="inhalt" aria-labelledby="hero-titel">
          <Bib
            className="hero-bib"
            band={<><span className="bib-brand">PaceMates</span><span>Laufen · Rad · Schwimmen · Triathlon</span></>}
            tear={<HeroDrop />}
          >
            <h1 id="hero-titel">Sieh, was dein Training wirklich tut.</h1>
            <p className="lead">
              PaceMates liest deine Läufe, Fahrten und Schwimmeinheiten aus Garmin und Strava und zeigt Umfang, Intensität, Verlauf, Form und Erholung. Mit Hinweisen, die sagen, aus welcher Zahl sie kommen.
            </p>
          </Bib>
          <div className="hero-side">
            <ul className="hero-facts" aria-label="Grundsätze">
              <li><strong>Kein Konto.</strong> Öffnen, importieren, lesen.</li>
              <li><strong>Keine Beispieldaten.</strong> Ohne deine Einheiten bleibt alles leer.</li>
              <li><strong>Bleibt im Browser.</strong> Dateien werden nicht hochgeladen.</li>
            </ul>
            <a className="hero-more" href="#so-gehts">So funktioniert es <ArrowDown size={16} aria-hidden="true" /></a>
          </div>
        </section>
      </div>

      <main>
        <section className="section problem" aria-labelledby="problem-titel">
          <div className="section-head">
            <h2 id="problem-titel">Viele Zahlen. Wenig Antworten.</h2>
            <p>Uhr und App sammeln jede Einheit. Die Fragen, die dich weiterbringen, beantworten sie selten auf einen Blick.</p>
          </div>
          <ul className="question-list">
            {questions.map((question) => <li key={question}>{question}</li>)}
          </ul>
          <p className="section-foot">PaceMates rechnet diese Fragen aus deinen eigenen Einheiten durch. Nicht im Vergleich zu anderen, sondern zu dir selbst von vor ein paar Wochen.</p>
        </section>

        <section className="section" id="so-gehts" aria-labelledby="so-titel">
          <div className="section-head">
            <h2 id="so-titel">So funktioniert es</h2>
          </div>
          <ol className="steps">
            <li>
              <span className="step-no" aria-hidden="true">1</span>
              <h3>Daten holen</h3>
              <p>Dateien aus Garmin Connect, Strava oder einer anderen Uhr ablegen: GPX, TCX, FIT, CSV oder ein ganzes ZIP. {stravaHosted ? 'Oder mit Strava verbinden. ' : ''}Vor dem Speichern siehst du, was erkannt wurde.</p>
            </li>
            <li>
              <span className="step-no" aria-hidden="true">2</span>
              <h3>Puls und Schwellen, wenn du willst</h3>
              <p>Maximale und Ruhe-Herzfrequenz, FTP oder Schwellenpace machen die Belastung je Einheit genauer. Ohne sie rechnet PaceMates mit der Dauer und sagt das dazu.</p>
            </li>
            <li>
              <span className="step-no" aria-hidden="true">3</span>
              <h3>Lesen und entscheiden</h3>
              <p>Übersicht, Trends, Vergleich, Form und Tipps. Was du daraus machst, entscheidest du.</p>
            </li>
          </ol>
        </section>

        <section className="section" aria-labelledby="ansichten-titel">
          <div className="section-head">
            <h2 id="ansichten-titel">Fünf Ansichten auf dein Training</h2>
          </div>
          <dl className="view-list">
            {views.map((view) => (
              <div key={view.title}>
                <dt>{view.title}</dt>
                <dd>{view.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="model-band" aria-labelledby="modell-titel">
          <div className="model-inner">
            <div className="section-head">
              <h2 id="modell-titel">Keine Blackbox. So wird gerechnet.</h2>
              <p>Jede Einheit bekommt eine Belastung. PaceMates nimmt das genaueste Verfahren, für das deine Daten reichen.</p>
            </div>
            <ol className="method-list">
              <li><strong>TRIMP</strong><span>aus Dauer und Herzfrequenzreserve, wenn Puls sowie maximale und Ruhe-Herzfrequenz da sind.</span></li>
              <li><strong>TSS</strong><span>aus Leistung und FTP, oder der Wert, der schon in der FIT-Datei steht.</span></li>
              <li><strong>Pace</strong><span>gegen deine Schwellenpace beim Laufen oder Schwimmen.</span></li>
              <li><strong>Dauer</strong><span>aus den Minuten, wenn nichts davon da ist. Dann steht das auch so dran.</span></li>
            </ol>
            <dl className="formula">
              <div><dt>Fitness (CTL)</dt><dd>42-Tage-Schnitt der Tagesbelastung</dd></div>
              <div><dt>Ermüdung (ATL)</dt><dd>7-Tage-Schnitt der Tagesbelastung</dd></div>
              <div><dt>Form (TSB)</dt><dd>CTL − ATL vom Vortag</dd></div>
            </dl>
            <p className="model-note">In den ersten sechs Wochen sind die Werte noch nicht stabil, weil die Reihe bei null startet. PaceMates sagt dir das, statt es zu verstecken.</p>
          </div>
        </section>

        <section className="section" aria-labelledby="quellen-titel">
          <div className="section-head">
            <h2 id="quellen-titel">Ohne deine Daten bleibt alles leer.</h2>
            <p>PaceMates legt keine Beispielkurven unter. Was du siehst, stammt aus deinen Einheiten.</p>
          </div>
          <div className="source-rows">
            <article>
              <h3>Dateien</h3>
              <span className="pill pill-ok">Sofort</span>
              <p>GPX, TCX, FIT und CSV, einzeln oder als ZIP, auch der komplette Strava- oder Garmin-Export. Funktioniert ohne Konto und ohne Anmeldung.</p>
            </article>
            <article>
              <h3>Strava</h3>
              <span className="pill">{stravaHosted ? 'Login' : 'Eigene API-App'}</span>
              <p>{stravaHosted
                ? 'Mit Strava anmelden, Lesezugriff erlauben, Aktivitäten holen. Spätere Abgleiche holen nur Neues. Doppelte Einheiten aus Datei und Strava werden zusammengeführt.'
                : 'Mit einer eigenen Strava-API-Anwendung, die du in fünf Minuten anlegst. Oder über den Strava-Datenexport als Datei.'}</p>
            </article>
            <article>
              <h3>Garmin</h3>
              <span className="pill">Export</span>
              <p>Export aus Garmin Connect als FIT, GPX oder TCX. Einen Garmin-Login gibt es nicht, weil Garmins Schnittstelle nur für freigegebene Partner offen ist.</p>
            </article>
          </div>
        </section>

        <section className="privacy-band" aria-labelledby="privat-titel">
          <h2 id="privat-titel">Deine Einheiten bleiben auf deinem Gerät.</h2>
          <p>PaceMates hat keine Datenbank mit deinen Aktivitäten. Dateien werden im Browser gelesen, nicht hochgeladen. Das heißt auch: Ein anderes Gerät sieht deine Daten nicht automatisch. Dafür gibt es die Sicherung als Datei.</p>
          <div className="row-actions">
            <Link className="btn btn-on-field" to="/app/daten#dateien">Erste Datei importieren <ArrowRight size={18} aria-hidden="true" /></Link>
            <Link className="btn btn-on-field-ghost" to="/datenschutz">Datenschutz lesen</Link>
          </div>
        </section>

        <section className="section faq" aria-labelledby="faq-titel">
          <div className="section-head">
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
