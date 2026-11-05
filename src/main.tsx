import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/syne/latin-700.css';
import '@fontsource/syne/latin-ext-700.css';
import '@fontsource/syne/latin-800.css';
import '@fontsource/syne/latin-ext-800.css';
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
