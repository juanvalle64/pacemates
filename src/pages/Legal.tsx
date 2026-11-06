import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ThemeSwitch, Wordmark } from '../components/Brand.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { operator, operatorComplete } from '../content/operator.ts';
import { stravaHosted } from '../lib/config.ts';
import { useDocumentTitle } from '../lib/theme.ts';

function Missing({ children }: { children: ReactNode }) {
  return <span className="missing">[{children}]</span>;
}

function LegalFrame({ title, children }: { title: string; children: ReactNode }) {
  useDocumentTitle(title);
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
      <main id="inhalt" className="page legal">
        <h1 tabIndex={-1}>{title}</h1>
        {!operator.reviewed || !operatorComplete() ? (
          <p className="note note-warn" role="note">
            Entwurf. Die Betreiberangaben sind noch nicht vollständig und der Text ist noch nicht rechtlich geprüft.
          </p>
        ) : null}
        {children}
        <p className="meta">Stand: {new Date(operator.updated).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </main>
      <SiteFooter />
    </div>
  );
}

export function Impressum() {
  return (
    <LegalFrame title="Impressum">
      <section>
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          {operator.name || <Missing>Vor- und Nachname oder Firma</Missing>}<br />
          {operator.address.length > 0
            ? operator.address.map((line) => <span key={line}>{line}<br /></span>)
            : <><Missing>Straße und Hausnummer</Missing><br /><Missing>PLZ und Ort</Missing><br /></>}
        </p>
        <h2>Kontakt</h2>
        <p>
          E-Mail: {operator.email ? <a href={`mailto:${operator.email}`}>{operator.email}</a> : <Missing>E-Mail-Adresse</Missing>}<br />
          {operator.phone ? <>Telefon: {operator.phone}</> : <>Telefon: <Missing>optional, zweiter schneller Kontaktweg</Missing></>}
        </p>
        {operator.vatId ? (
          <>
            <h2>Umsatzsteuer-ID</h2>
            <p>{operator.vatId}</p>
          </>
        ) : null}
        {operator.editorialResponsible ? (
          <>
            <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
            <p>{operator.editorialResponsible}</p>
          </>
        ) : null}
        <h2>Haftung für Inhalte und Hinweise</h2>
        <p>PaceMates rechnet Kennzahlen aus den Aktivitäten, die du selbst importierst. Die Hinweise folgen festen trainingsmethodischen Regeln. Sie sind keine medizinische Beratung und ersetzen keine Trainerin, keinen Trainer und keine ärztliche Untersuchung.</p>
      </section>
    </LegalFrame>
  );
}

export function Datenschutz() {
  return (
    <LegalFrame title="Datenschutz">
      <section>
        <h2>Kurz gesagt</h2>
        <ul className="plain checklist">
          <li>Es gibt kein PaceMates-Konto und keine PaceMates-Datenbank mit deinen Aktivitäten.</li>
          <li>Importierte Dateien werden in deinem Browser gelesen und nicht hochgeladen.</li>
          <li>Aktivitäten, Name und Modell-Eingaben liegen nur im Speicher deines Browsers auf deinem Gerät.</li>
          <li>Keine Cookies, keine Analyse- oder Werbedienste, keine eingebundenen Schriften oder Skripte von Dritten.</li>
          <li>Daten verlassen dein Gerät nur, wenn du sie selbst exportierst oder Strava verbindest. Dann tauscht dein Browser Daten direkt mit Strava aus.</li>
        </ul>

        <h2>Verantwortlicher</h2>
        <p>
          {operator.name || <Missing>Name</Missing>}, {operator.address.length > 0 ? operator.address.join(', ') : <Missing>Anschrift</Missing>}<br />
          E-Mail: {operator.email || <Missing>E-Mail</Missing>}
        </p>

        <h2>Aufruf der Website</h2>
        <p>PaceMates ist eine statische Web-App. Sie wird über {operator.hosting.name} ausgeliefert, einen Dienst von {operator.hosting.company}. Beim Aufruf verarbeitet der Hoster technisch notwendige Zugriffsdaten wie IP-Adresse, Zeitpunkt, aufgerufene Adresse und Browserkennung, um die Seite auszuliefern und vor Missbrauch zu schützen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Der Betreiber von PaceMates hat auf diese Protokolle keinen Zugriff. Dabei kann eine Übermittlung in die USA stattfinden. Details: <a href={operator.hosting.privacyUrl} rel="noreferrer">Datenschutzerklärung des Hosters</a>.</p>

        <h2>Speicherung im Browser</h2>
        <p>Damit deine Auswertung beim nächsten Besuch noch da ist, speichert PaceMates in deinem Browser:</p>
        <ul className="plain">
          <li>Aktivitäten (IndexedDB, Datenbank „pacemates“): Startzeit, Dauer, Distanz, Sportart, Name, Höhenmeter und, falls vorhanden, Herzfrequenz, Leistung und Kalorien. GPS-Spuren werden nicht gespeichert.</li>
          <li>Profil (localStorage): optionaler Name, maximale und Ruhe-Herzfrequenz, FTP, Schwellenpace.</li>
          <li>Strava-Verbindung (localStorage), nur wenn du sie nutzt: Zugangs- und Erneuerungsschlüssel, bei eigener API-Anwendung auch deren Client-ID und Client Secret.</li>
          <li>Darstellung hell oder dunkel (localStorage).</li>
        </ul>
        <p>Diese Speicherung ist für den Dienst, den du ausdrücklich nutzt, unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Sie bleibt auf deinem Gerät, bis du sie in PaceMates unter Daten → Löschen oder über die Browsereinstellungen entfernst. Der Betreiber kann diese Daten nicht einsehen.</p>
        <p>Herzfrequenzwerte können Gesundheitsdaten sein. Sie werden ausschließlich lokal in deinem Browser verarbeitet und nicht an den Betreiber übermittelt.</p>

        <h2>Strava</h2>
        <p>Wenn du Strava verbindest, leitet PaceMates dich zur Anmeldung an Strava, Inc. (USA) weiter. Du entscheidest dort, ob PaceMates deine Aktivitäten lesen darf (Freigabe <code>activity:read_all</code>). Danach ruft dein Browser die Aktivitäten direkt bei Strava ab. Es gilt zusätzlich die Datenschutzerklärung von Strava. Den Zugriff widerrufst du in PaceMates über „Verbindung trennen“ oder bei Strava unter Einstellungen → Meine Apps.</p>
        {stravaHosted ? (
          <p>Für die Anmeldung schickt dein Browser einen einmaligen Anmeldecode und später den Erneuerungsschlüssel an den PaceMates-Token-Dienst. Er läuft bei {operator.tokenProxy.name} ({operator.tokenProxy.company}), ergänzt das geheime Client Secret und reicht die Anfrage an Strava weiter. Der Dienst speichert weder Codes noch Schlüssel noch Aktivitäten. Dabei verarbeitet der Anbieter technisch deine IP-Adresse; eine Übermittlung in die USA ist möglich. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, weil du die Verbindung selbst anstößt. <a href={operator.tokenProxy.privacyUrl} rel="noreferrer">Datenschutzerklärung des Anbieters</a>.</p>
        ) : (
          <p>Mit einer eigenen Strava-API-Anwendung läuft auch der Token-Tausch direkt zwischen deinem Browser und Strava. Kein Server von PaceMates ist beteiligt.</p>
        )}

        <h2>Garmin</h2>
        <p>PaceMates hat keine Verbindung zu Garmin. Du exportierst Dateien selbst aus Garmin Connect und liest sie in PaceMates ein. Dabei wird nichts an Garmin oder an den Betreiber übertragen.</p>

        <h2>Sicherungen</h2>
        <p>Eine Sicherung ist eine JSON-Datei, die dein Browser lokal erzeugt. Wohin du sie danach kopierst, entscheidest du.</p>

        <h2>Deine Rechte</h2>
        <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15 bis 21 DSGVO) sowie auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO){operator.supervisoryAuthority ? `, zum Beispiel bei ${operator.supervisoryAuthority}` : ''}. Weil der Betreiber keine Trainingsdaten von dir speichert, liegt die Kontrolle über sie vollständig bei dir in PaceMates.</p>
      </section>
    </LegalFrame>
  );
}
