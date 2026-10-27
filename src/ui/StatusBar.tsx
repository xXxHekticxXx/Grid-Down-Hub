import { useEffect, useState } from 'react';
import { fmtBytes, storageInfo } from '../lib/opfs';
import { loadManifest, packState } from '../lib/packs';
import { href } from '../lib/router';

declare const __BUILD_DATE__: string;
const CONTENT_CHECKED = '2026-10-27';

export function useOfflineReady() {
  const [st, setSt] = useState<{ ready: boolean; missing: number; osm: string; used: number }>({ ready: false, missing: 0, osm: '—', used: 0 });
  useEffect(() => {
    let live = true;
    (async () => {
      const m = await loadManifest();
      const info = await storageInfo();
      let missing = 0;
      if (m) for (const p of m.packs.filter((p) => p.required)) if (!(await packState(p.id)).complete) missing++;
      // ready = all required packs installed and the app shell itself is stored for offline use
      const ready = !!m && missing === 0 && (isApp() || !!navigator.serviceWorker?.controller);
      if (live) setSt({ ready, missing: m ? missing : -1, osm: m?.osmDate ?? '—', used: info.used });
    })();
    return () => {
      live = false;
    };
  }, []);
  return st;
}
const isApp = () => !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

export default function StatusBar() {
  const st = useOfflineReady();
  return (
    <div className="status" role="status" aria-label="Offline status">
      <a href={href('/setup')}>
        <span className={`dot ${st.ready ? '' : 'off'}`} />
        {st.ready ? 'Offline ready' : st.missing === -1 ? 'Map data not downloaded' : st.missing > 0 ? `${st.missing} data pack${st.missing > 1 ? 's' : ''} to download` : 'Finishing setup'}
      </a>
      <span>Storage {fmtBytes(st.used)}</span>
      <span>Map data {st.osm}</span>
      <span>Content checked {CONTENT_CHECKED}</span>
      <span title="App version date">App {__BUILD_DATE__}</span>
    </div>
  );
}
