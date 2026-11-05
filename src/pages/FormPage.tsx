import { Lines } from '../components/Charts.tsx';
import { ModelForm } from '../components/ModelForm.tsx';
import { EmptyState, NoDataYet } from '../components/Ui.tsx';
import { useAthlete } from '../context/athlete-state.ts';
import { formatDateKey, formatLoad, methodLabel } from '../lib/format.ts';
import { highestRecordedHr, loadMix, MODEL_WARMUP_DAYS, readForm } from '../lib/form-reading.ts';
import { useDocumentTitle } from '../lib/theme.ts';

export function FormPage() {
  useDocumentTitle('Form');
  const { ready, storageError, evaluated, series, profile, updateProfile } = useAthlete();
  if (storageError) return <EmptyState level={1} title="Speicher nicht verfügbar" body={storageError} />;
  if (!ready) return <p className="status">Aktivitäten werden gelesen …</p>;
  if (evaluated.length === 0 || series.length === 0) {
    return (
      <>
        <NoDataYet title="Noch keine Formkurve" body="Fitness, Ermüdung und Form werden aus der Belastung deiner importierten Einheiten berechnet. Ohne Aktivitäten bleibt diese Seite leer." />
        <section className="card" id="modell" aria-labelledby="modell-titel">
          <h2 id="modell-titel">Eingaben für das Modell</h2>
          <p>Du kannst sie schon jetzt eintragen. Sie machen die Belastung je Einheit genauer. Leere Felder bleiben leer: PaceMates schätzt keine Schwellen.</p>
          <ModelForm profile={profile} onChange={updateProfile} />
        </section>
      </>
    );
  }
  const latest = series[series.length - 1]!;
  const { items: mix, proxyShare, total: totalLoad } = loadMix(evaluated);
  const reading = readForm(series, evaluated);
  const shown = series.length > 120 ? series.filter((_, index) => index % Math.ceil(series.length / 180) === 0 || index === series.length - 1) : series;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">Fitness, Ermüdung, Form</p>
          <h1 tabIndex={-1}>Form & Erholung</h1>
          <p className="lead-sm">Wie viel Training du trägst, wie müde du gerade bist, und was davon übrig bleibt.</p>
        </div>
      </header>
      <section className="stat-grid">
        <article className="stat"><span>Fitness, CTL</span><strong className="num">{formatLoad(latest.ctl)}</strong></article>
        <article className="stat"><span>Ermüdung, ATL</span><strong className="num">{formatLoad(latest.atl)}</strong></article>
        <article className="stat"><span>Form heute früh, TSB</span><strong className="num">{formatLoad(latest.tsb)}</strong></article>
      </section>
      {reading ? (
        <div className={`note form-note form-${reading.tone}`} role="status">
          <p><strong>{reading.title}.</strong> {reading.body}</p>
        </div>
      ) : null}
      <section className="card explain" aria-labelledby="lesen-titel">
        <h2 id="lesen-titel">So liest du die drei Werte</h2>
        <dl className="explain-grid">
          <div>
            <dt><span className="swatch" style={{ background: 'var(--ctl)' }} />Fitness (CTL)</dt>
            <dd>Der geglättete Schnitt deiner Tagesbelastung über etwa 42 Tage. Steigt langsam, wenn du regelmäßig trainierst, und fällt langsam in Pausen.</dd>
          </div>
          <div>
            <dt><span className="swatch" style={{ background: 'var(--atl)' }} />Ermüdung (ATL)</dt>
            <dd>Derselbe Schnitt über etwa 7 Tage. Reagiert schnell auf harte oder lange Tage.</dd>
          </div>
          <div>
            <dt><span className="swatch" style={{ background: 'var(--tsb)' }} />Form (TSB)</dt>
            <dd>Fitness minus Ermüdung, jeweils vom Vortag. Also der Stand am Morgen, bevor du trainierst. Im Minus heißt: Die letzten Tage waren mehr als dein Schnitt.</dd>
          </div>
        </dl>
        <details className="sub">
          <summary>Rechnung und Grenzen</summary>
          <p><code>wert = wert + (tagesbelastung − wert) / zeitkonstante</code>, mit 42 Tagen für CTL und 7 Tagen für ATL. Die Reihe startet am Tag deiner ersten importierten Einheit bei null.</p>
          <ul className="plain">
            <li>In den ersten {MODEL_WARMUP_DAYS} Tagen steigt die Fitness auch bei gleichem Training. Erst danach ist die Kurve stabil.</li>
            <li>Tage ohne importierte Einheit zählen als Ruhetage. Fehlen Einheiten, sieht die Form zu gut aus.</li>
            <li>Die Werte beschreiben Trainingsbelastung, nicht Gesundheit. Schlaf, Krankheit oder Stress kennt das Modell nicht.</li>
            <li>Die Zahlen sind nur mit deinen eigenen früheren Werten vergleichbar, nicht mit denen anderer Leute oder Apps.</li>
          </ul>
        </details>
      </section>
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
        {proxyShare > 0.5 ? (
          <p className="note note-warn">{Math.round(proxyShare * 100)} % der Belastung sind ein Dauer-Proxy, weil Herzfrequenz, Leistung oder Schwellenpace fehlen. Ein harter Intervalllauf zählt dann so viel wie ein lockerer Lauf gleicher Dauer. CTL, ATL und TSB sind so nur grob. Trag unten maximale und Ruheherzfrequenz ein oder importiere Dateien mit Puls.</p>
        ) : null}
        <p className="meta">PaceMates wählt je Einheit das genaueste verfügbare Verfahren, in dieser Reihenfolge: TRIMP aus Herzfrequenzreserve und Dauer, TSS aus Leistung gegen die FTP oder aus der Datei, Pace gegen die Schwellenpace, sonst der Dauer-Proxy aus den Minuten.</p>
      </section>
      <section className="card" id="modell" aria-labelledby="modell-titel">
        <h2 id="modell-titel">Eingaben für das Modell</h2>
        <p>Optional, aber sie machen die Belastung je Einheit genauer. Leere Felder bleiben leer: PaceMates schätzt keine Schwellen. Änderungen rechnen sofort die ganze Historie neu.</p>
        <ModelForm profile={profile} onChange={updateProfile} recordedHr={highestRecordedHr(evaluated)} />
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
