'use client';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { authFetch } from '@/lib/authFetch';
import { LIVE_PRICING_POLICY_REVISION, PRICING_POLICY_HEADER } from '@/lib/membership-policy';
import { saveAssetToLibrary } from '@/lib/api';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { toolAssetRefSchema, type ToolAssetRef, type ToolResult } from '@/lib/toolbox/contract';
import { defaultFinishingSettings, finishingSettingsSchemas, FINISHING_QUALITY_CHOICES, type FinishingToolId, type ToolQuality } from '@/lib/toolbox/finishing';
import { MediaDestinationActions } from '@/components/library/MediaDestinationActions.client';
import type { AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';
import { useToolQuote } from './useToolQuote';
import { ToolWorkbench, ToolSourceInput, ToolProcessing, ToolAuthNotice } from './ToolWorkbench';
import { ToolboxVideoPreview } from './ToolboxVideoPreview';
import { toolboxCopy } from './toolbox-copy';
import { finishingCopy } from './finishing-copy';
import { useUpscaleLibraryAssets } from './upscale/_hooks/useUpscaleLibraryAssets';
import { UpscaleLibraryModal } from './upscale/_components/UpscaleLibraryModal';
import { DEFAULT_UPSCALE_COPY } from './upscale/_lib/upscale-workspace-copy';
import { upscaleWorkspaceLabels } from './upscale/_lib/upscale-workspace-labels';
import { uploadSourceFile } from './upscale/_lib/upscale-workspace-helpers';
import styles from './tool-workbench.module.css';

export default function FinishingWorkspace({ toolId, releasedQualities }: { toolId: FinishingToolId; releasedQualities: ToolQuality[] }) {
  const auth = useRequireAuth({ redirectIfLoggedOut: false });
  return <FinishingSession key={`${auth.user?.id ?? 'guest'}:${toolId}`} auth={auth} toolId={toolId} releasedQualities={releasedQualities} />;
}

export function FinishingSession({ auth, toolId, releasedQualities = [] }: { auth: ReturnType<typeof useRequireAuth>; toolId: FinishingToolId; releasedQualities?: ToolQuality[] }) {
  const { locale } = useI18n();
  const userId = auth.user?.id;
  const copy = toolboxCopy(locale), labels = finishingCopy(locale);
  const libraryCopy = { ...DEFAULT_UPSCALE_COPY, ...upscaleWorkspaceLabels(locale) };
  const [settings, setSettings] = useState(() => defaultFinishingSettings(toolId));
  const [source, setSource] = useState<{ source: ToolAssetRef; url: string; name: string; thumbnailUrl?: string | null } | null>(null);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [viewMode, setViewMode] = useState<'source' | 'result'>('source');
  const [busy, setBusy] = useState(false), [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null), [message, setMessage] = useState<string | null>(null);
  const active = useRef(true), lock = useRef(false), selection = useRef(0), requestId = useRef<string | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const library = useUpscaleLibraryAssets({ user: auth.user, mediaType: 'video', libraryErrorCopy: libraryCopy.libraryError });
  const block = source ? { toolId, version: 1, inputs: [source.source], settings } : null;
  const pricing = useToolQuote(block, auth.user?.id);
  const released = releasedQualities.includes(settings.quality) && pricing.quote?.released === true;
  const output = result?.outputs[0];
  const pendingKey = `toolbox:pending:${auth.user?.id ?? 'guest'}:${toolId}`;
  useEffect(() => {
    if (!userId) return;
    try { const stored = sessionStorage.getItem(pendingKey); if (stored) setPendingJobId(stored); } catch { /* Storage may be disabled. */ }
  }, [userId, pendingKey]);
  useEffect(() => {
    if (!pendingJobId || !userId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    lock.current = true; setRunning(true);
    try { sessionStorage.setItem(pendingKey, pendingJobId); } catch { /* Polling still works without storage. */ }
    function finish() {
      try { sessionStorage.removeItem(pendingKey); } catch { /* Optional browser persistence. */ }
      setPendingJobId(null); lock.current = false; setRunning(false); requestId.current = null;
    }
    async function poll() {
      try {
        const response = await authFetch(`/api/tools/run?jobId=${encodeURIComponent(pendingJobId!)}`, { signal: controller.signal });
        const data = await response.json();
        if (cancelled) return;
        if (response.status === 404 || data.status === 'failed') { finish(); setError(labels.failure); return; }
        if (data.ok && data.status === 'completed' && data.result?.outputs?.length) { setResult(data.result); setViewMode('result'); finish(); return; }
      } catch { /* A network interruption keeps the same stored job. */ }
      if (!cancelled) timer = setTimeout(() => void poll(), 5000);
    }
    void poll();
    return () => { cancelled = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, [pendingJobId, userId, pendingKey, labels.failure]);


  function changeSettings(patch: Record<string, unknown>) {
    if (lock.current || busy) return;
    setSettings(finishingSettingsSchemas[toolId].parse({ ...settings, ...patch }));
    setResult(null); setViewMode('source'); setError(null); setMessage(null); requestId.current = null;
  }
  async function chooseSource(url: string, name: string, attempt: number, thumbnailUrl?: string | null) {
    const response = await authFetch('/api/tools/source', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal: AbortSignal.timeout(30_000) });
    const data = await response.json();
    if (!response.ok || !data.ok || !data.url) throw new Error('Source unavailable.');
    const ref = toolAssetRefSchema.parse(data.source);
    if (ref.kind !== 'video') throw new Error('Video required.');
    if (active.current && selection.current === attempt) setSource({ source: ref, url: data.url, name, thumbnailUrl });
  }
  async function selectAsset(asset: AssetBrowserAsset) {
    if (lock.current || busy) return;
    const attempt = ++selection.current;
    setBusy(true); setError(null); setMessage(null); setSource(null); setResult(null); setViewMode('source'); requestId.current = null;
    library.setLibraryModalOpen(false);
    try { await chooseSource(asset.url, copy.library, attempt, asset.thumbUrl); }
    catch { if (active.current && selection.current === attempt) setError(labels.sourceFailure); }
    finally { if (active.current && selection.current === attempt) setBusy(false); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || lock.current || busy) return;
    const attempt = ++selection.current;
    setBusy(true); setError(null); setMessage(null); setSource(null); setResult(null); setViewMode('source'); requestId.current = null;
    try {
      if (!file.type.startsWith('video/')) throw new Error('Video required.');
      const uploaded = await uploadSourceFile(file, 'video');
      if (active.current && selection.current === attempt) await chooseSource(uploaded.url, file.name, attempt);
    } catch { if (active.current && selection.current === attempt) setError(labels.sourceFailure); }
    finally { if (active.current && selection.current === attempt) setBusy(false); }
  }
  async function run() {
    if (lock.current || busy || !block || !auth.user || !pricing.quote || !released) return;
    lock.current = true; setRunning(true); setError(null); setMessage(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await authFetch('/api/tools/run', { method: 'POST', headers: { 'Content-Type': 'application/json', [PRICING_POLICY_HEADER]: LIVE_PRICING_POLICY_REVISION },
        body: JSON.stringify({ block, requestId: requestId.current, acceptedQuote: { totalCents: pricing.quote.totalCents, currency: pricing.quote.currency } }) });
      const data = await response.json();
      if (!response.ok || !data.ok) { requestId.current = null; throw new Error(data.error === 'INSUFFICIENT_FUNDS' ? labels.insufficientFunds : labels.failure); }
      if (!active.current) return;
      if (data.status === 'failed') { requestId.current = null; throw new Error(labels.failure); }
      if (data.result?.outputs?.length) { setResult(data.result); setViewMode('result'); requestId.current = null; }
      else if (data.jobId) setPendingJobId(data.jobId);
      else throw new Error(labels.failure);
    } catch (failure) { if (active.current) { setError(failure instanceof Error ? failure.message : labels.failure); pricing.refresh(); } }
    finally { lock.current = false; if (active.current) setRunning(false); }
  }
  async function save() {
    if (!output || !result) return;
    try {
      await saveAssetToLibrary({ url: output.originalUrl, jobId: result.jobId, sourceOutputId: output.asset.type === 'job-output' ? output.asset.outputId : null, kind: 'video', source: 'saved_job_output' });
      if (active.current) setMessage(labels.saved);
    } catch { if (active.current) setError(libraryCopy.saveFailed); }
  }
  const controlClass = 'min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm';
  return <ToolWorkbench locale={locale} visual={toolId}
    source={<ToolSourceInput locale={locale} kind="video" allowUrl={false} url={source?.url ?? ''} name={source?.name} disabled={!auth.user || running} uploading={busy} onUpload={upload} onLibrary={library.openLibraryModal} onUrlChange={() => {}} />}
    settings={<section className={styles.finishingSettings}>
      <fieldset disabled={running || busy} className="space-y-4">
        {FINISHING_QUALITY_CHOICES[toolId].length > 1 ? <div><label className="mb-2 block text-xs" id={`${toolId}-quality`}>{labels.quality}</label><div className={styles.segments} role="group" aria-labelledby={`${toolId}-quality`}>{FINISHING_QUALITY_CHOICES[toolId].map(quality => <button className="flex-1" type="button" key={quality} aria-pressed={settings.quality === quality} onClick={() => changeSettings({ quality })}>{labels[quality]}</button>)}</div></div> : null}
        {'resolution' in settings ? <label className="block text-xs">{labels.resolution}<select className={`${controlClass} mt-2`} value={settings.resolution} onChange={e => changeSettings({ resolution: e.target.value })}><option value="1080p">1080p</option><option value="4k">4K</option></select></label> : null}
        {'strength' in settings ? <label className="block text-xs">{labels.strength}<select className={`${controlClass} mt-2`} value={settings.strength} onChange={e => changeSettings({ strength: e.target.value })}>{(['auto', 'light', 'strong'] as const).map(value => <option value={value} key={value}>{labels[value]}</option>)}</select></label> : null}
        {'fps' in settings ? <label className="block text-xs">{labels.fps}<select className={`${controlClass} mt-2`} value={settings.fps} onChange={e => changeSettings({ fps: Number(e.target.value) })}><option value={60}>60 fps</option><option value={120}>120 fps</option></select></label> : null}
      </fieldset>
      {(toolId === 'restore-video' && settings.quality === 'pro') || pricing.quote?.generative ? <p className="mt-3 text-xs text-text-secondary">{labels.reconstruction}</p> : null}
      <button type="button" className="mt-5 min-h-11 w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-on-brand" disabled={!released || !auth.user || running || busy || !pricing.ready} onClick={() => void run()}>{running ? copy.processing : pricing.loading ? copy.priceLoading : !releasedQualities.includes(settings.quality) ? labels.validation : labels.run}{pricing.quote && !running ? ` · ${new Intl.NumberFormat(locale, { style: 'currency', currency: pricing.quote.currency }).format(pricing.quote.totalCents / 100)}` : ''}</button>
      {!releasedQualities.includes(settings.quality) ? <p className="mt-2 text-xs text-text-secondary">{labels.qualification}</p> : null}
      {pricing.error ? <button type="button" className="mt-2 text-xs underline" onClick={pricing.refresh}>{copy.retryPrice}</button> : null}
    </section>}
    preview={<>{running ? <ToolProcessing locale={locale} /> : null}<ToolboxVideoPreview locale={locale} visual={toolId} sourceUrl={source?.url ?? ''} sourceThumbnailUrl={source?.thumbnailUrl} result={output ? { output: { url: output.originalUrl, thumbnailUrl: output.thumbnailUrl } } : null} viewMode={viewMode} onViewModeChange={setViewMode} onSave={() => void save()} onDownload={() => { const url = viewMode === 'result' ? output?.originalUrl : source?.url; if (url) void triggerAppDownload(url, suggestDownloadFilename(url, toolId)); }} />{output && result ? <MediaDestinationActions locale={locale} userId={auth.user?.id} asset={{ id: output.asset.type === 'job-output' ? output.asset.outputId : output.asset.assetId, jobId: result.jobId, sourceOutputId: output.asset.type === 'job-output' ? output.asset.outputId : null, url: output.originalUrl, kind: 'video', source: 'recent', thumbUrl: output.thumbnailUrl }} /> : null}</>}
  >
    {!auth.loading && !auth.user ? <ToolAuthNotice locale={locale} path={`/app/tools/${toolId}`} /> : null}
    {error ? <p role="alert" className="mb-4 text-sm text-error">{error}</p> : null}{message ? <p role="status" className="mb-4 text-sm">{message}</p> : null}
    <UpscaleLibraryModal open={library.libraryModalOpen && !running} assets={library.visibleLibraryAssets} copy={libraryCopy} error={library.libraryError} isLoading={library.libraryLoading} mediaType="video" onClose={() => library.setLibraryModalOpen(false)} onRefresh={library.fetchLibraryAssets} onSelectAsset={asset => void selectAsset(asset)} onSourceChange={next => void library.fetchLibraryAssets({ kind: 'video', source: next })} source={library.librarySource} sourceOptions={library.librarySourceOptions} />
  </ToolWorkbench>;
}
