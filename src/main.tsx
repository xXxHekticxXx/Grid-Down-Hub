import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import { applyTheme, loadSettings } from './lib/util';

applyTheme(loadSettings());
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Updates are never silent: the Settings page offers an "Install update" button.
const w = window as unknown as { __gdhUpdate?: boolean; __gdhApply?: () => void; __gdhReg?: ServiceWorkerRegistration };
const updateSW = registerSW({
  onNeedRefresh() {
    w.__gdhUpdate = true;
    window.dispatchEvent(new Event('gdh-update'));
  },
  onRegisteredSW(_url, reg) {
    if (reg) w.__gdhReg = reg;
  }
});
w.__gdhApply = () => {
  updateSW(true);
};

// Ask the browser to keep our data (maps, PDFs, your plan) and not evict it.
try {
  navigator.storage?.persist?.().then((ok) => {
    try {
      localStorage.setItem('gdh-persist', ok ? 'granted' : 'denied');
    } catch {
      /* ignore */
    }
  });
} catch {
  /* ignore */
}
