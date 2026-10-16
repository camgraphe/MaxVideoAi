'use client';

import { useCallback, useRef, useState } from 'react';
import { TurnstileChallenge } from '@/components/ui/TurnstileChallenge';

type DiagnosticRequest = {
  captchaToken: string;
  captchaSiteKey?: string;
  mode: 'hosted' | 'express_checkout';
};

export function TurnstileDiagnostic({ activeSiteKey, widgets }: {
  activeSiteKey: string;
  widgets: Array<{ generation: string; siteKey: string }>;
}) {
  // Retain the rendered widget identity when a tab outlives a deployment.
  const [siteKey, setSiteKey] = useState(activeSiteKey);
  const [legacyPayload, setLegacyPayload] = useState(false);
  const [mode, setMode] = useState<DiagnosticRequest['mode']>('hosted');
  const [loaded, setLoaded] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState(false);
  const [pending, setPending] = useState(false);
  const [canReplay, setCanReplay] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const inFlight = useRef(false);
  // Tokens stay in this tab's memory only; never render or persist them.
  const lastRequest = useRef<DiagnosticRequest | null>(null);
  const onToken = useCallback((value: string | null) => { setToken(value); setCaptchaError(false); }, []);
  const onError = useCallback(() => { setToken(null); setCaptchaError(true); }, []);

  function newChallenge() {
    setToken(null);
    setCaptchaError(false);
    setResult(null);
    setGeneration(value => value + 1);
    setLoaded(true);
  }

  async function submit(replay = false) {
    if (inFlight.current) return;
    const payload = replay ? lastRequest.current : token ? {
      captchaToken: token, mode, ...(legacyPayload ? {} : { captchaSiteKey: siteKey }),
    } : null;
    if (!payload) return;
    inFlight.current = true;
    setPending(true);
    setResult(null);
    setToken(null);
    lastRequest.current = payload;
    setCanReplay(true);
    try {
      const response = await fetch('/api/admin/turnstile-diagnostic', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), cache: 'no-store',
      });
      const body = await response.json();
      setResult(JSON.stringify({ status: response.status, ...body }, null, 2));
    } catch {
      setResult('Diagnostic unavailable. Load a new challenge before retrying validation.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const buttonClass = 'rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <section className="max-w-3xl space-y-5 rounded-2xl border border-border bg-surface p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Turnstile validation diagnostic</h1>
        <p className="text-sm text-text-secondary">Validate a CAPTCHA and its replay using the checkout guard. This creates technical audit entries only. No payment, top-up or wallet change is performed.</p>
        <p className="text-sm text-text-secondary">Keep this tab open through a deployment to check compatibility. The widget selection stays unchanged until you change it or reload.</p>
      </header>
      <fieldset disabled={pending} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="diagnostic-widget">Widget</label>
          <select id="diagnostic-widget" className="block w-full rounded-lg border border-border bg-surface p-2" value={siteKey} onChange={event => {
            setSiteKey(event.target.value); setLoaded(false); setToken(null); setResult(null);
            lastRequest.current = null; setCanReplay(false);
          }}>
            {widgets.map(widget => <option key={widget.siteKey} value={widget.siteKey}>{widget.generation}: {widget.siteKey}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={legacyPayload} onChange={event => setLegacyPayload(event.target.checked)} />
          Simulate an old tab (omit widget identifier)
        </label>
        <div className="space-y-1">
          <label htmlFor="diagnostic-mode">Checkout mode</label>
          <select id="diagnostic-mode" className="block rounded-lg border border-border bg-surface p-2" value={mode} onChange={event => setMode(event.target.value as DiagnosticRequest['mode'])}>
            <option value="hosted">Hosted</option>
            <option value="express_checkout">Express</option>
          </select>
        </div>
      </fieldset>
      {loaded ? <TurnstileChallenge siteKey={siteKey} resetGeneration={generation} onToken={onToken} onError={onError} /> : null}
      <p role="status" className="text-sm text-text-secondary">{captchaError ? 'Challenge failed. Load a new challenge.' : token ? 'Token ready for validation.' : 'Load a challenge to obtain a fresh token.'}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonClass} disabled={pending} onClick={newChallenge}>{loaded ? 'New challenge' : 'Load challenge'}</button>
        <button type="button" className={buttonClass} disabled={pending || !token} onClick={() => void submit()}>Validate</button>
        <button type="button" className={buttonClass} disabled={pending || !canReplay} onClick={() => void submit(true)}>Replay last token</button>
      </div>
      <p className="text-xs text-text-secondary">Replay resends the last submitted token, widget identity and mode. A successful token must be rejected on replay.</p>
      <pre data-testid="diagnostic-result" aria-live="polite" className="overflow-auto rounded-lg bg-bg p-4 text-xs">{pending ? 'Validating…' : result ?? 'No validation submitted.'}</pre>
    </section>
  );
}
