import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Sport } from '../lib/types.ts';

export function EmptyState({ title, body, children, level = 2 }: { title: string; body: string; children?: ReactNode; level?: 1 | 2 }) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <section className="empty">
      <Heading tabIndex={level === 1 ? -1 : undefined}>{title}</Heading>
      <p>{body}</p>
      {children}
    </section>
  );
}

/** Leerer Zustand einer Auswertungsseite: sagt, was hier stehen wird, und wie Daten reinkommen. */
export function NoDataYet({ title, body }: { title: string; body: string }) {
  return (
    <EmptyState level={1} title={title} body={body}>
      <div className="row-actions">
        <Link className="btn btn-primary" to="/app/daten#dateien">Dateien importieren</Link>
        <Link className="btn btn-ghost" to="/app/daten#strava">Strava verbinden</Link>
      </div>
      <p className="meta">PaceMates zeigt hier keine Beispielkurven. Alles, was erscheint, stammt aus deinen Einheiten.</p>
    </EmptyState>
  );
}

export function SportMark({ sport }: { sport: Sport }) {
  return <span className={`mark mark-${sport}`} aria-hidden="true" />;
}
