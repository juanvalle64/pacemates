import { Component, lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { Shell } from './components/Shell.tsx';
import { AthleteProvider } from './context/AthleteContext.tsx';
import { routerBasename } from './lib/paths.ts';
import { Landing } from './pages/Landing.tsx';

const Overview = lazy(() => import('./pages/Overview.tsx').then((module) => ({ default: module.Overview })));
const Trends = lazy(() => import('./pages/Trends.tsx').then((module) => ({ default: module.Trends })));
const Compare = lazy(() => import('./pages/Compare.tsx').then((module) => ({ default: module.Compare })));
const FormPage = lazy(() => import('./pages/FormPage.tsx').then((module) => ({ default: module.FormPage })));
const TipsPage = lazy(() => import('./pages/TipsPage.tsx').then((module) => ({ default: module.TipsPage })));
const DataPage = lazy(() => import('./pages/DataPage.tsx').then((module) => ({ default: module.DataPage })));
const Impressum = lazy(() => import('./pages/Legal.tsx').then((module) => ({ default: module.Impressum })));
const Datenschutz = lazy(() => import('./pages/Legal.tsx').then((module) => ({ default: module.Datenschutz })));
const StravaCallback = lazy(() => import('./pages/StravaCallback.tsx').then((module) => ({ default: module.StravaCallback })));

interface BoundaryState { error: Error | null }
class Boundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <main className="page narrow" role="alert">
          <h1>Etwas ist schiefgelaufen</h1>
          <p>{this.state.error.message}</p>
          <p className="meta">Deine gespeicherten Aktivitäten sind davon nicht betroffen.</p>
          <button type="button" className="btn btn-primary" onClick={() => this.setState({ error: null })}>Erneut versuchen</button>
        </main>
      );
    }
    return this.props.children;
  }
}

function NotFound() {
  return (
    <main id="inhalt" className="page">
      <h1>Seite nicht gefunden</h1>
      <p>Diese Adresse gibt es in PaceMates nicht.</p>
      <Link className="btn btn-primary" to="/">Zur Startseite</Link>
    </main>
  );
}

export default function App() {
  return (
    <AthleteProvider>
      <BrowserRouter basename={routerBasename()}>
        <Boundary>
          <Suspense fallback={<p className="status page">Wird geladen …</p>}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={<Shell />}>
              <Route index element={<Overview />} />
              <Route path="trends" element={<Trends />} />
              <Route path="vergleich" element={<Compare />} />
              <Route path="form" element={<FormPage />} />
              <Route path="tipps" element={<TipsPage />} />
              <Route path="daten" element={<DataPage />} />
            </Route>
            <Route path="/strava/callback" element={<StravaCallback />} />
            <Route path="/impressum" element={<Impressum />} />
            <Route path="/datenschutz" element={<Datenschutz />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </Boundary>
      </BrowserRouter>
    </AthleteProvider>
  );
}
