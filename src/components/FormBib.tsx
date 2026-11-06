import type { ReactNode } from 'react';
import { formatLoad } from '../lib/format.ts';
import type { FormReading } from '../lib/form-reading.ts';
import type { DailyPoint } from '../lib/types.ts';
import { Bib } from './Brand.tsx';

/** Die Form des Tages als Startnummer: TSB groß, Fitness und Ermüdung daneben. Alle Werte gerechnet, nichts geschätzt. */
export function FormBib({ point, reading, children }: { point: DailyPoint; reading: FormReading; children?: ReactNode }) {
  return (
    <Bib
      className={`form-bib form-${reading.tone}`}
      band={<><span className="bib-brand">Form heute früh</span><span className={`pill pill-on-band pill-${reading.tone}`}>{reading.title}</span></>}
    >
      <div className="form-bib-grid">
        <p className="bib-number">
          <strong className="num">{formatLoad(point.tsb)}</strong>
          <span>Form, TSB</span>
        </p>
        <dl className="form-bib-side">
          <div><dt>Fitness, CTL</dt><dd className="num">{formatLoad(point.ctl)}</dd></div>
          <div><dt>Ermüdung, ATL</dt><dd className="num">{formatLoad(point.atl)}</dd></div>
        </dl>
      </div>
      <p className="form-bib-text">{reading.body}</p>
      {children}
    </Bib>
  );
}
