import { Link } from 'react-router';
import { Lines } from '../components/Charts.tsx';
import { ModelForm } from '../components/ModelForm.tsx';
import { EmptyState } from '../components/Ui.tsx';
import { useAthlete } from '../context/athlete-state.ts';
import { formatDateKey, formatLoad, methodLabel } from '../lib/format.ts';
import { useDocumentTitle } from '../lib/theme.ts';
import type { LoadMethod } from '../lib/types.ts';

export function FormPage() {
  useDocumentTitle('Form');
  const { ready, storageError, evaluated, series, profile, updateProfile } = useAthlete();
  if (storageError) return <EmptyState title="Speicher nicht verfügbar" body={storageError} />;
  if (!ready) return <p className="status">Aktivitäten werden gelesen …</p>;
  if (evaluated.length === 0 || series.length === 0) {
    return (
      <EmptyState title="Noch keine Formkurve" body="CTL, ATL und TSB werden aus importierten Einheiten berechnet. Ohne Aktivitäten bleibt diese Seite leer.">
        <Link className="btn btn-primary" to="/app/daten">Daten hinzufügen</Link>
      </EmptyState>
    );
  }
  const latest = series[series.length - 1]!;
  const mix = (['trimp', 'tss', 'pace', 'duration'] as LoadMethod[])
    .map((method) => ({
      method,
      count: evaluated.filter((activity) => activity.loadMethod === method).length,
      load: evaluated.filter((activity) => activity.loadMethod === method).reduce((sum, activity) => sum + activity.load, 0),
    }))
    .filter((item) => item.count > 0);
  const totalLoad = mix.reduce((sum, item) => sum + item.load, 0);
  const proxy = mix.find((item) => item.method === 'duration');
  const shown = series.length > 120 ? series.filter((_, index) => index % Math.ceil(series.length / 180) === 0 || index === series.length - 1) : series;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">Fitness, Ermüdung, Form</p>
          <h1>Form & Erholung</h1>
          <p>CTL ist der exponentiell geglättete 42-Tage-Schnitt der Tagesbelastung, ATL der 7-Tage-Schnitt. Die Form (TSB) ist CTL minus ATL vom Vortag, also der Wert vor der Belastung des Tages.</p>
        </div>
      </header>
      <section className="stat-grid">
        <article className="stat"><span>Fitness, CTL</span><strong className="num">{formatLoad(latest.ctl)}</strong></article>
        <article className="stat"><span>Ermüdung, ATL</span><strong className="num">{formatLoad(latest.atl)}</strong></article>
        <article className="stat"><span>Form heute früh, TSB</span><strong className="num">{formatLoad(latest.tsb)}</strong></article>
      </section>
      {series.length < 42 ? (
        <p className="note note-warn">Die Reihe hat {series.length} Tage und startet bei null. In den ersten sechs Wochen steigt die Fitness auch bei gleichbleibendem Training. Lies die Kurve erst danach als stabile Form.</p>
      ) : (
        <p className="note">Die Historie umfasst {series.length} Tage. Tage ohne Einheit gehen mit Belastung 0 in die Glättung ein.</p>
      )}
      <section className="card">
        <h2>Verlauf</h2>
        <Lines
          label="Fitness, Ermüdung und Form über die importierte Historie"
          categories={shown.map((point) => formatDateKey(point.date, false))}
          formatValue={formatLoad}
          series={[
            { key: 'ctl', label: 'Fitness (CTL)', color: 'var(--ctl)', values: shown.map((point) => point.ctl) },
            { key: 'atl', label: 'Ermüdung (ATL)', color: 'var(--atl)', values: shown.map((point) => point.atl) },
            { key: 'tsb', label: 'Form (TSB)', color: 'var(--tsb)', values: shown.map((point) => point.tsb) },
          ]}
        />
      </section>
      <section className="card">
        <h2>Woraus die Belastung kommt</h2>
        <ul className="split">
          {mix.map((item) => (
            <li key={item.method}>
              <span>{methodLabel(item.method)}</span>
              <strong className="num">{item.count} Einheiten</strong>
              <em className="num">{totalLoad > 0 ? `${Math.round((item.load / totalLoad) * 100)} %` : '–'}</em>
            </li>
          ))}
        </ul>
        {proxy && totalLoad > 0 && proxy.load / totalLoad > 0.5 ? (
          <p className="note note-warn">Der größte Teil der Belastung ist ein Dauer-Proxy, weil Herzfrequenz, Leistung oder Schwellenpace fehlen. CTL, ATL und TSB sind dann nur grob vergleichbar. Trag maximale und Ruheherzfrequenz ein oder importiere Dateien mit Puls.</p>
        ) : null}
        <p className="meta">TRIMP nutzt Dauer und Herzfrequenzreserve. TSS nutzt Leistung gegen die FTP oder einen Wert aus der Datei. Pace nutzt die eingetragene Schwelle. Der Dauer-Proxy nutzt nur die Minuten.</p>
      </section>
      <section className="card">
        <h2>Eingaben für das Modell</h2>
        <p className="meta">Leere Felder bleiben leer. PaceMates schätzt keine Schwellen und fragt kein Geschlecht ab. Der TRIMP-Faktor 1,92 ist die übliche Voreinstellung, 1,67 die Alternative aus derselben Formel.</p>
        <ModelForm profile={profile} onChange={updateProfile} />
      </section>
      <section className="card">
        <h2>Letzte 14 Tage</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Tag</th>
                <th scope="col">Belastung</th>
                <th scope="col">CTL</th>
                <th scope="col">ATL</th>
                <th scope="col">TSB</th>
              </tr>
            </thead>
            <tbody>
              {series.slice(-14).map((point) => (
                <tr key={point.date}>
                  <th scope="row">{formatDateKey(point.date)}</th>
                  <td className="num">{formatLoad(point.load)}</td>
                  <td className="num">{formatLoad(point.ctl)}</td>
                  <td className="num">{formatLoad(point.atl)}</td>
                  <td className="num">{formatLoad(point.tsb)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
