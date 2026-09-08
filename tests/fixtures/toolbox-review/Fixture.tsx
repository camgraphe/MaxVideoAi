'use client';
import { useEffect, useRef, useState } from 'react';
import { UpscaleSession } from '@/components/tools/UpscaleWorkspace';
import { BackgroundRemovalSession } from '@/components/tools/BackgroundRemovalWorkspace';
import { ToolboxCatalogue } from '@/components/tools/ToolboxCatalogue';
import { I18nProvider, useI18n } from '@/lib/i18n/I18nProvider';
import { useThemePreference } from '@/hooks/useThemePreference';
import type { useRequireAuth } from '@/hooks/useRequireAuth';

export default function Fixture() {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState('image');
  const [account, setAccount] = useState('fixture-a');
  const [locale, setLocale] = useState<'en' | 'fr' | 'es'>('fr');
  const [calls, setCalls] = useState<string[]>([]);
  const nextFailure = useRef(false);
  const { dictionary, fallback } = useI18n();
  const { toggleTheme } = useThemePreference();
  useEffect(() => {
    const originalFetch = window.fetch;
    const asset = (kind: string) => ({ id: `fixture-source-${kind}`, kind, url: `${location.origin}${kind === 'video' ? '/toolbox-review/source.mp4' : '/assets/tools/angle-orbit-product-source.webp'}`, mime: kind === 'video' ? 'video/mp4' : 'image/webp', width: 640, height: 360, createdAt: new Date().toISOString(), source: 'upload', name: `Local ${kind} fixture`, label: `Local ${kind} fixture`, thumbUrl: `${location.origin}/assets/tools/angle-orbit-product-source.webp?signature=fixture%2Bexact` });
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin);
      if (url.origin !== location.origin) throw new Error('External requests disabled in fixture');
      if (!url.pathname.startsWith('/api/')) return originalFetch(input, init);
      setCalls(previous => [...previous.slice(-5), `${init?.method ?? 'GET'} ${url.pathname}`]);
      const json = (data: unknown, status = 200) => Response.json(data, { status });
      if (url.pathname === '/api/tools/quote') {
        await new Promise(resolve => setTimeout(resolve, 450));
        if (nextFailure.current) { nextFailure.current = false; return json({ ok: false }, 422); }
        const body = JSON.parse(String(init?.body));
        return json({ ok: true, quote: { totalCents: body.upscaleFactor === 4 ? 24 : 12, currency: 'USD' } });
      }
      if (url.pathname.startsWith('/api/tools/')) {
        const body = JSON.parse(String(init?.body));
        await new Promise(resolve => setTimeout(resolve, 1200));
        const kind = body.mediaType ?? 'video';
        return json({ ok: true, jobId: 'fixture-job', engineId: body.engineId ?? 'bria-background-removal', engineLabel: 'Local simulated result', mediaType: kind, latencyMs: 1200, pricing: { totalCents: body.acceptedQuote.totalCents, estimatedCostUsd: body.acceptedQuote.totalCents / 100, estimatedCredits: 12, currency: 'USD' }, output: { url: `${location.origin}${kind === 'video' ? '/toolbox-review/source.mp4' : '/assets/tools/angle-orbit-product-45.webp'}`, assetId: 'fixture-result', width: 640, height: 360, mimeType: kind === 'video' ? 'video/mp4' : 'image/webp', persisted: true } });
      }
      if (url.pathname.startsWith('/api/uploads/')) return json({ ok: true, asset: asset(url.pathname.endsWith('/video') ? 'video' : 'image') });
      if (url.pathname === '/api/user-assets' || url.pathname === '/api/media-library/assets') return json({ ok: true, assets: [asset(url.searchParams.get('kind') ?? 'image')] });
      if (url.pathname === '/api/jobs') return json({ ok: true, jobs: [], nextCursor: null });
      return json({ ok: true, assets: [], data: [], jobs: [], balance: 100 });
    };
    setReady(true);
    return () => { window.fetch = originalFetch; };
  }, []);
  const auth = { loading: false, user: { id: account } } as ReturnType<typeof useRequireAuth>;
  return <I18nProvider locale={locale} dictionary={dictionary} fallback={fallback}><div className="border-b border-border bg-surface p-3 text-xs"><strong>LOCAL SIMULATION · no processing, payment or save · outputs are sample assets</strong><div className="flex flex-wrap gap-3">{['catalogue','image','video','background'].map(value => <button key={value} className="min-h-11 underline" onClick={() => setMode(value)}>{value}</button>)}<button className="min-h-11 underline" onClick={() => setAccount(value => value === 'fixture-a' ? 'fixture-b' : 'fixture-a')}>Switch account</button><button className="min-h-11 underline" onClick={() => { nextFailure.current = true; }}>Fail next quote</button><button className="min-h-11 underline" onClick={toggleTheme}>Toggle theme</button><select value={locale} onChange={event => setLocale(event.target.value as typeof locale)}><option>fr</option><option>en</option><option>es</option></select></div><output>{calls.join(' · ')}</output></div>{ready ? mode === 'catalogue' ? <ToolboxCatalogue locale={locale} /> : mode === 'background' ? <BackgroundRemovalSession key={`${account}:${mode}`} auth={auth} /> : <UpscaleSession key={`${account}:${mode}`} auth={auth} initialKind={mode === 'video' ? 'video' : 'image'} /> : null}</I18nProvider>;
}
