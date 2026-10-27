import { useEffect, useRef, useState } from 'react';
import { torch, torchSet, keepAwake } from '../lib/native';
import { SOS_PATTERN, whistleBlast, audio } from '../lib/audio';
import { Btn } from '../ui/ui';

export function FlashlightTool() {
  const [on, setOn] = useState(false);
  const [screen, setScreen] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => () => { void torch(false); void keepAwake(false); }, []);
  const toggle = async () => {
    if (on) {
      await torch(false);
      setOn(false);
      return;
    }
    const ok = await torch(true);
    if (ok) {
      setOn(true);
      setMsg('');
    } else {
      setMsg('This device or browser does not allow the camera light. Using the screen as a light instead.');
      setScreen(true);
      void keepAwake(true);
    }
  };
  return (
    <div className="stack">
      <button className="cpr-start" style={{ minHeight: 140 }} onClick={toggle} aria-pressed={on} data-testid="torch">
        {on ? 'LIGHT OFF' : 'LIGHT ON'}
      </button>
      <Btn onClick={() => { setScreen(true); void keepAwake(true); }}>Screen light (white)</Btn>
      {msg && <p className="small">{msg}</p>}
      {screen && (
        <div className="flash-full on" onClick={() => { setScreen(false); void keepAwake(false); }} role="button" aria-label="Turn screen light off">
          <span className="small">Tap anywhere to turn off. Turn screen brightness all the way up.</span>
        </div>
      )}
    </div>
  );
}

export function SosTool() {
  const [mode, setMode] = useState<'off' | 'sos' | 'strobe'>('off');
  const [lit, setLit] = useState(false);
  const [torchOk, setTorchOk] = useState<boolean | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => stop(), []);
  function stop() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    void torch(false);
    void keepAwake(false);
    setLit(false);
    setMode('off');
  }
  async function run(m: 'sos' | 'strobe') {
    stop();
    setMode(m);
    void keepAwake(true);
    const ok = await torch(true);
    setTorchOk(ok);
    let i = 0;
    const step = () => {
      const [on, dur] = m === 'sos' ? SOS_PATTERN[i % SOS_PATTERN.length] : [i % 2 === 0, 0.25] as [boolean, number];
      setLit(on);
      if (ok) void torchSet(on);
      i++;
      timer.current = window.setTimeout(step, dur * 1000);
    };
    step();
  }
  const whistle = () => {
    const a = audio();
    const t = a.currentTime + 0.05;
    for (let k = 0; k < 3; k++) whistleBlast(t + k * 1.6, 1.0);
  };
  return (
    <div className="stack">
      <div className="grid2">
        <button className="cpr-start" onClick={() => (mode === 'sos' ? stop() : run('sos'))} aria-pressed={mode === 'sos'} data-testid="sos">{mode === 'sos' ? 'STOP' : 'SOS FLASH'}</button>
        <button className="cpr-start" style={{ background: 'var(--ink)', color: 'var(--bg)' }} onClick={whistle} data-testid="whistle">WHISTLE ×3</button>
      </div>
      <Btn onClick={() => (mode === 'strobe' ? stop() : run('strobe'))}>{mode === 'strobe' ? 'Stop strobe' : 'Fast strobe (find me)'}</Btn>
      <p className="small">SOS in light: three short, three long, three short (· · · — — — · · ·), repeated. Three of anything (blasts, flashes, fires) means "help". {torchOk === false && 'The camera light is not available here, so the screen flashes instead.'}</p>
      {mode !== 'off' && (
        <div className={`flash-full ${lit ? 'on' : 'off'}`} onClick={stop} role="button" aria-label="Stop signaling">
          <b style={{ fontSize: 'calc(var(--fs)*2)' }}>{mode === 'sos' ? 'SOS' : 'STROBE'}</b>
          <span className="small">Tap to stop</span>
        </div>
      )}
    </div>
  );
}
