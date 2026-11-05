import type { ReactNode } from 'react';
import type { Sport } from '../lib/types.ts';

export function EmptyState({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <section className="empty">
      <h2>{title}</h2>
      <p>{body}</p>
      {children}
    </section>
  );
}

export function SportMark({ sport }: { sport: Sport }) {
  return <span className={`mark mark-${sport}`} aria-hidden="true" />;
}
