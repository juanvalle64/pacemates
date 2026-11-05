import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-ext-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-ext-700.css';
import '@fontsource/barlow-condensed/latin-700-italic.css';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-ext-400.css';
import '@fontsource/outfit/latin-500.css';
import '@fontsource/outfit/latin-ext-500.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/outfit/latin-ext-600.css';
import App from './App.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
