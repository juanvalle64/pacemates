import { Link } from 'react-router';
import { EmptyState } from '../components/Ui.tsx';
import { useAthlete } from '../context/athlete-state.ts';
import { buildTips } from '../lib/tips.ts';
import { useDocumentTitle } from '../lib/theme.ts';

export function TipsPage() {
  useDocumentTitle('Tipps');
  const { ready, storageError, evaluated } = useAthlete();
  if (storageError) return <EmptyState title="Speicher nicht verfügbar" body={storageError} />;
  if (!ready) return <p className="status">Aktivitäten werden gelesen …</p>;
  const report = buildTips(evaluated);
  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">Nur aus gerechneten Werten</p>
          <h1>Tipps</h1>
          <p>Jeder Hinweis nennt die Kennzahl, aus der er kommt. Wenn die Daten nicht reichen, bleibt die Liste leer.</p>
        </div>
      </header>
      {report.status === 'empty' ? (
        <EmptyState title="Noch keine Grundlage" body="Hinweise gibt es erst nach echten Aktivitäten. Es wird nichts aus leeren Zahlen abgeleitet.">
          <Link className="btn btn-primary" to="/app/daten">Daten hinzufügen</Link>
        </EmptyState>
      ) : null}
      {report.status === 'thin' ? (
        <EmptyState
          title="Zu wenig für einen Hinweis"
          body="Es braucht mindestens 3 Einheiten und 7 Tage zwischen der ersten und der letzten. Darunter würde ein Tipp nur so tun, als wäre ein Muster da."
        >
          <dl className="facts">
            {report.facts.map((fact) => (
              <div key={fact.label}><dt>{fact.label}</dt><dd className="num">{fact.value}</dd></div>
            ))}
          </dl>
        </EmptyState>
      ) : null}
      {report.status === 'ready' || report.status === 'stale' ? (
        <ul className="tip-list">
          {report.tips.map((tip) => (
            <li key={tip.id} className={`tip tip-${tip.severity}`}>
              <p className="kicker">{tip.severity === 'high' ? 'Wichtig' : tip.severity === 'medium' ? 'Hinweis' : tip.severity === 'positive' ? 'Stabil' : 'Einordnung'}</p>
              <h2>{tip.title}</h2>
              <p>{tip.body}</p>
              <ul className="evidence">
                {tip.evidence.map((item) => (
                  <li key={item.label}><span>{item.label}</span><strong className="num">{item.value}</strong></li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
      <details className="card rules">
        <summary>Welche Regeln es gibt</summary>
        <ul>
          <li>Steiler Anstieg der 7-Tage-Belastung gegenüber den 7 Tagen davor.</li>
          <li>Form (TSB) deutlich im Minus, erst ab 42 Tagen Historie.</li>
          <li>Fitness (CTL) steigt in einer Woche um mehr als 6 Punkte, erst ab 42 Tagen.</li>
          <li>Hohe Monotonie über 7 Tage.</li>
          <li>Neun oder mehr Tage in Folge über 30 Belastungspunkten.</li>
          <li>Umfang steigt, Belastung pro Stunde bleibt flach.</li>
          <li>Erholte Form bei unterdurchschnittlicher Intensität.</li>
          <li>Bei erkennbarem Triathlon-Muster fehlt eine der drei Sportarten im letzten Block.</li>
          <li>Aktive Tage gehen deutlich zurück.</li>
          <li>Der längste Lauf oder die längste Fahrt hat einen kleinen Anteil am Umfang.</li>
        </ul>
      </details>
      <p className="footnote">Diese Hinweise entstehen aus festen Regeln auf deinen berechneten Werten. Sie ersetzen keine Trainerin und keine medizinische Einschätzung.</p>
    </>
  );
}
