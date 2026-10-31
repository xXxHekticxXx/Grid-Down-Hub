// Home-screen notice when an update is downloaded or needs the new APK.
import { useEffect, useState } from 'react';
import { onUpdateState, applyNow, type UpdateState } from '../lib/updater';

export function UpdateBanner() {
  const [st, setSt] = useState<UpdateState | null>(null);
  useEffect(() => onUpdateState(setSt), []);
  if (!st) return null;
  if (st.kind === 'ready')
    return (
      <div className="card card-ok update-banner" role="status">
        <span><b>Update {st.version} is downloaded.</b> It switches in next time you open the app.</span>
        <button className="btn btn-go" onClick={() => void applyNow()}>Update now</button>
      </div>
    );
  if (st.kind === 'apk')
    return (
      <div className="card card-info update-banner" role="status">
        <span><b>Version {st.version} needs a quick install.</b> Your plan, pins and maps stay.</span>
        <a className="btn btn-go" href={st.apk} target="_blank" rel="noreferrer">Install</a>
      </div>
    );
  return null;
}
