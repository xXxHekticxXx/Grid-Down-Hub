import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import App from './App';
import { SettingsProvider } from './lib/settings';
import { askPersist } from './lib/opfs';

// Ask the browser to keep this app's storage even when the device is low on space.
void askPersist();

// Used by the automated test that proves a phone export imports identically on the laptop.
(window as unknown as { __gdhFingerprint?: () => Promise<string> }).__gdhFingerprint = () => import('./lib/backup').then((m) => m.fingerprint());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </StrictMode>,
);
