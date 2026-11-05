import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/** Nach einem Seitenwechsel landet der Fokus auf der Überschrift, bei einem Anker auf dem Abschnitt. */
export function useRouteFocus(): void {
  const location = useLocation();
  const first = useRef(true);
  useEffect(() => {
    const state = { tries: 0, frame: 0 };
    const isFirst = first.current;
    first.current = false;
    const run = () => {
      const id = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
      const target = id ? document.getElementById(id) : document.querySelector<HTMLElement>('main h1');
      if (!target) {
        state.tries += 1;
        if (state.tries < 30) state.frame = requestAnimationFrame(run);
        return;
      }
      if (id) target.scrollIntoView({ block: 'start' });
      else if (!isFirst) window.scrollTo(0, 0);
      if (isFirst && !id) return;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };
    state.frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(state.frame);
  }, [location.pathname, location.hash]);
}
