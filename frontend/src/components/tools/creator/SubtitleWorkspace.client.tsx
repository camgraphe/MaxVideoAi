'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, Save, SlidersHorizontal, Loader2, CheckCircle2 } from 'lucide-react';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { authFetch } from '@/lib/authFetch';
import { triggerAppDownload } from '@/lib/download';
import { parseSubtitleDocument, type SubtitleDocument, type SubtitleStyle } from '@/lib/subtitles/document';
import { SubtitleStylePicker } from './SubtitleStylePicker.client';
import { ToolMediaHandoff } from '@/components/library/ToolMediaHandoff.client';
import { MediaDestinationActions } from '@/components/library/MediaDestinationActions.client';
import { ToolAuthNotice } from '../ToolWorkbench';
import { CreatorWorkbench, CreatorInspiration } from './CreatorWorkbench.client';
import { creatorExperienceCopy } from './creator-experience-copy';
import { CreatorSourcePicker } from './CreatorSourcePicker.client';
import { selectCreatorSource, type CreatorSource } from './creator-source-selection';
import { CreatorOperationPanel } from './CreatorOperationPanel';
import { CreatorMediaPreview } from './CreatorMediaPreview';
import { SubtitleRecentDocuments } from './SubtitleRecentDocuments';
import { SubtitlePreview, SubtitleDocumentEditor } from './SubtitleDocumentEditor';
import { useCreatorOperation, webPricingPolicyHeaders } from './useCreatorOperation';
import { creatorWorkspaceCopy } from './creator-workspace-copy';
import styles from './creator-workspace.module.css';

export type StudioSubtitleSource = {projectId:string;sequenceId:string;expectedRevision:number};
type TranscriptResult = { documentId: string; revision: number };
type RenderResult = TranscriptResult & { assetId: string; originalUrl: string; thumbnailUrl?: string | null; readUrl?: string | null; thumbnailReadUrl?: string | null };
export default function SubtitleWorkspace({initialDocument,executionEnabled = true,initialOperationId,studioSource}: {initialDocument?: {id:string;revision?:number};executionEnabled?:boolean;initialOperationId?:string;studioSource?:StudioSubtitleSource}) {
  const auth = useRequireAuth({redirectIfLoggedOut:false}), {locale} = useI18n();
  return <SubtitleSession key={`${auth.user?.id ?? 'guest'}:${initialDocument?.id ?? ''}:${initialDocument?.revision ?? ''}:${initialOperationId ?? ''}:${studioSource?.projectId ?? ''}:${studioSource?.sequenceId ?? ''}:${studioSource?.expectedRevision ?? ''}`} userId={auth.user?.id} locale={locale} initialDocument={initialDocument} executionEnabled={executionEnabled} initialOperationId={initialOperationId} studioSource={studioSource} />;
}
export function SubtitleSession({userId,locale,initialDocument,executionEnabled = true,initialOperationId,studioSource}: {userId?: string; locale: string;initialDocument?: {id:string;revision?:number};executionEnabled?:boolean;initialOperationId?:string;studioSource?:StudioSubtitleSource}) {
  const copy = creatorWorkspaceCopy(locale), experience = creatorExperienceCopy(locale);
  const recoveryScope = initialDocument ? JSON.stringify(['document',initialDocument.id,initialDocument.revision??null]) : studioSource ? JSON.stringify(['sequence',studioSource.projectId,studioSource.sequenceId,studioSource.expectedRevision]) : undefined;
  const transcription = useCreatorOperation<TranscriptResult | RenderResult>({userId,toolId:'subtitles',family:'subtitles',executionEnabled,initialOperationId,recoveryScope});
  const render = useCreatorOperation<RenderResult>({userId,toolId:'subtitles-export',family:'subtitles',executionEnabled,recoveryScope,resumeStored:!initialOperationId});
  const selectedStudioSource = studioSource ?? transcription.subtitle?.sequence;
  // An operation link keeps subsequent exports under the same recovery identity.
  const exportOperation = initialOperationId ? transcription : render;
  const recoveredSubtitle = render.subtitle?.document ? render.subtitle : transcription.subtitle;
  const [requestedDocument,setRequestedDocument] = useState(initialDocument);
  const [source,setSource] = useState<CreatorSource | null>(null), [kind,setKind] = useState<'audio'|'video'>('video');
  const [language,setLanguage] = useState(''), [keyterms,setKeyterms] = useState(''), [uploadBusy,setUploadBusy] = useState(false);
  const [saved,setSaved] = useState<SubtitleDocument | null>(null), [draft,setDraft] = useState<SubtitleDocument | null>(null);
  const [saving,setSaving] = useState(false), [loading,setLoading] = useState(false), [error,setError] = useState<string | null>(null);
  const [loadRevision,setLoadRevision] = useState(0), [previewRevision,setPreviewRevision] = useState(0), [downloadBusy,setDownloadBusy] = useState(false);
  const active = useRef(true), saveLock = useRef(false), loadEpoch = useRef(0);
  const saveRequest = useRef<{id:string;fingerprint:string} | null>(null);
  const working = transcription.running || render.running, disabled = working || transcription.busy || render.busy || saving || loading || uploadBusy;
  const dirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));
  const result = transcription.result;
  const loadId = requestedDocument?.id ?? render.result?.documentId ?? result?.documentId, targetRevision = requestedDocument?.revision ?? render.result?.revision ?? result?.revision;
  const renderResult = render.result ?? (result && 'originalUrl' in result ? result : null);
  const retryRender = render.result ? render.retry : transcription.retry;
  const renderReadUrl = renderResult?.readUrl === undefined ? renderResult?.originalUrl : renderResult.readUrl;
  const renderPoster = renderResult?.thumbnailReadUrl === undefined ? renderResult?.thumbnailUrl : renderResult.thumbnailReadUrl;
  useEffect(() => {
    const restored=recoveredSubtitle;
    if (!restored || !(transcription.needsConfirmation || render.needsConfirmation)) return;
    setLanguage(restored.settings.language??'');setKeyterms(restored.settings.keyterms.join(', '));
    if (restored.document) setRequestedDocument(restored.document);
    if (restored.source && restored.sourceMedia?.readUrl) {
      setSource({ref:restored.source,url:restored.sourceMedia.readUrl,name:restored.sourceMedia.name??copy.source,thumbnailUrl:restored.sourceMedia.thumbnailReadUrl,durationSec:restored.sourceMedia.durationSec});
      setKind(restored.source.kind as 'audio'|'video');
    }
  },[recoveredSubtitle,transcription.needsConfirmation,render.needsConfirmation,copy.source]);
  useEffect(() => { active.current = true; return () => { active.current = false; loadEpoch.current += 1; }; }, []);
  const readDocument = useCallback(async (documentId: string, revision?: number) => {
    const attempt = ++loadEpoch.current; setLoading(true); setError(null);
    try {
      const response = await authFetch(`/api/tools/subtitles/documents/${encodeURIComponent(documentId)}${revision ? `?revision=${revision}` : ''}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error('DOCUMENT_UNAVAILABLE');
      const document = parseSubtitleDocument(data.document);
      if (!active.current || attempt !== loadEpoch.current) return;
      setSaved(document); setDraft(document); setPreviewRevision(value => value + 1); saveRequest.current = null;
      // The route resolves an owned source separately from the immutable caption document.
      if (data.sourceMedia?.url) {
        setSource({ref:document.source.ref,url:data.sourceMedia.url,name:data.sourceMedia.name ?? copy.source,thumbnailUrl:data.sourceMedia.thumbnailUrl});
        setKind(document.source.ref.kind as 'audio'|'video');
      } else setSource(null);
    } catch { if (active.current && attempt === loadEpoch.current) setError('DOCUMENT_UNAVAILABLE'); }
    finally { if (active.current && attempt === loadEpoch.current) setLoading(false); }
  // The immutable operation result owns document loads; operation invalidation has no data dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copy.source]);
  useEffect(() => {
    if (!userId) return;
    if (loadId) void readDocument(loadId,targetRevision);
  }, [userId,loadId,targetRevision,loadRevision]); // eslint-disable-line react-hooks/exhaustive-deps
  function changeSource(next: CreatorSource | null) {
    if (working || saving) return;
    loadEpoch.current += 1; setLoading(false); setRequestedDocument(undefined); transcription.invalidate(); render.invalidate(); setSaved(null); setDraft(null); setError(null); setSource(next); saveRequest.current = null;
  }
  function changeDocument(next: SubtitleDocument) { if (disabled) return; setDraft(next); setError(null); exportOperation.invalidate(); }
  async function save() {
    if (!draft || !saved || disabled || saveLock.current || !dirty) return;
    let document: SubtitleDocument;
    try { document = parseSubtitleDocument(draft); } catch {setError('INVALID_CAPTIONS');return;}
    const change = {segments:document.segments,style:document.style}, fingerprint = JSON.stringify({documentId:saved.id,expectedRevision:saved.revision,change});
    if (saveRequest.current?.fingerprint !== fingerprint) saveRequest.current = {id:crypto.randomUUID(),fingerprint};
    saveLock.current = true; setSaving(true); setError(null);
    try {
      const response = await authFetch(`/api/tools/subtitles/documents/${encodeURIComponent(saved.id)}`, {method:'PATCH',headers:webPricingPolicyHeaders(),body:JSON.stringify({expectedRevision:saved.revision,requestId:saveRequest.current.id,change})});
      const data = await response.json();
      if (!active.current) return;
      if (!response.ok || !data.ok) throw new Error(data.error?.code ?? 'SAVE_FAILED');
      const updated = parseSubtitleDocument(data.document); setSaved(updated); setDraft(updated); saveRequest.current = null; exportOperation.invalidate();
    } catch(failure) { if (active.current) setError(failure instanceof Error ? failure.message : 'SAVE_FAILED'); }
    finally { saveLock.current = false; if (active.current) setSaving(false); }
  }
  async function refreshPreview() {
    if (!saved || loading) return;
    const attempt = ++loadEpoch.current; setLoading(true);
    try {
      const response = await authFetch(`/api/tools/subtitles/documents/${encodeURIComponent(saved.id)}?revision=${saved.revision}`), data = await response.json();
      if (!active.current || attempt !== loadEpoch.current) return;
      if (!response.ok || !data.ok) throw new Error('PREVIEW_UNAVAILABLE');
      setPreviewRevision(value => value + 1);
      setSource(data.sourceMedia?.url ? {ref:saved.source.ref,url:data.sourceMedia.url,name:data.sourceMedia.name ?? copy.source,thumbnailUrl:data.sourceMedia.thumbnailUrl} : null);
      if (!data.sourceMedia?.url) setError('PREVIEW_UNAVAILABLE');
    } catch { if (active.current && attempt === loadEpoch.current) setError('PREVIEW_UNAVAILABLE'); }
    finally { if (active.current && attempt === loadEpoch.current) setLoading(false); }
  }
  async function download(format:'srt'|'vtt') {
    if (!saved || dirty || disabled || downloadBusy) return;
    setDownloadBusy(true); setError(null);
    try {
      const response = await authFetch(`/api/tools/subtitles/documents/${encodeURIComponent(saved.id)}/download?format=${format}&revision=${saved.revision}`);
      if (!response.ok) throw new Error('DOWNLOAD_FAILED');
      const blob = await response.blob(); if (!active.current) return;
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = `subtitles-${saved.id}-r${saved.revision}.${format}`; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url),1000);
    } catch { if (active.current) setError('DOWNLOAD_FAILED'); }
    finally { if (active.current) setDownloadBusy(false); }
  }
  const conflict = error === 'SUBTITLE_REVISION_CONFLICT' || error === 'SUBTITLE_REQUEST_CONFLICT';
  const captionStyle = (patch:Partial<SubtitleStyle>) => { if (draft) changeDocument({...draft,style:{...draft.style,...patch}}); };
  return <CreatorWorkbench locale={locale} toolId="subtitles" title={copy.titles.subtitles} activeStep={renderResult || render.running ? 2 : draft ? 1 : 0}
    source={<div className={styles.sourceGroup}>{selectedStudioSource ? <section className={styles.sourceCard}><h2>{copy.studioSequence}</h2><p>{transcription.sourceSummary?.name ?? copy.studioSequence}</p><p>{copy.sequenceRevision} {selectedStudioSource.expectedRevision}</p><p className={styles.notice}>{copy.mixHint}</p></section> : <><div className={styles.segmented}>{(['video','audio'] as const).map(value => <button type="button" key={value} aria-pressed={kind === value} disabled={disabled} onClick={() => {changeSource(null);setKind(value);}}>{copy[value]}</button>)}</div>
      <CreatorSourcePicker userId={userId} locale={locale} label={kind === 'video' ? experience.subtitleVideo : experience.subtitleAudio} hint={experience.transcriptHint} kind={kind} source={source} onChange={changeSource} disabled={disabled} onBusyChange={busy => {setUploadBusy(busy);if(busy){transcription.invalidate();render.invalidate();}}} /><p className={styles.notice}>{copy.preserved}</p></>}
    </div>}
    settings={<div className={styles.settings}>{!draft ? <>
      <label>{copy.language}<select aria-label={copy.language} value={language} disabled={disabled} onChange={event => {transcription.invalidate();setLanguage(event.target.value);}}><option value="">{copy.auto}</option><option value="en">English</option><option value="fr">Français</option><option value="es">Español</option></select></label>
      <details className={styles.advanced}><summary><SlidersHorizontal size={17} aria-hidden="true" />{experience.advanced}</summary><div className={styles.settings}><label>{copy.keyterms}<textarea maxLength={5100} value={keyterms} disabled={disabled} onChange={event => {transcription.invalidate();setKeyterms(event.target.value);}} /><small>{copy.keytermsHint}</small></label></div></details>
      <CreatorOperationPanel locale={locale} operation={transcription} disabledReason={!userId ? copy.signIn : !executionEnabled ? copy.executionClosed : !source && !selectedStudioSource ? experience.chooseSource : undefined} disabled={!executionEnabled || !userId || (!source && !selectedStudioSource) || uploadBusy || loading} onPrepare={() => {const terms=keyterms.split(',').map(value => value.trim()).filter(Boolean),settings={...language?{language}:{},keyterms:terms};if(selectedStudioSource)void transcription.prepare({...selectedStudioSource,...settings},'/prepare-studio');else if(source)void transcription.prepare({source:source.ref,...settings});}} />
    </> : <>
      <SubtitleStylePicker locale={locale} value={draft.style.preset} disabled={disabled} onChange={preset => captionStyle({preset})} />
      <label>{copy.position}<select aria-label={copy.position} disabled={disabled} value={draft.style.position} onChange={event => captionStyle({position:event.target.value as SubtitleStyle['position']})}>{(['bottom','center','top'] as const).map(value => <option key={value} value={value}>{copy[value]}</option>)}</select></label>
      <label>{copy.fontSize}<input type="range" min="2" max="10" step="0.5" value={draft.style.fontSizePercent} disabled={disabled} onChange={event => captionStyle({fontSizePercent:Number(event.target.value)})} /></label>
      <p className={styles.notice}>{experience.savedText}</p>
    </>}
    {error ? <div className={styles.error} role="alert"><p>{conflict ? copy.conflict : error === 'INVALID_CAPTIONS' ? copy.invalidCaptions : error === 'DOWNLOAD_FAILED' ? copy.downloadError : copy.error}</p>
      {conflict && saved ? <button type="button" disabled={disabled} onClick={() => void readDocument(saved.id)}>{copy.restore}</button> : error === 'DOCUMENT_UNAVAILABLE' ? <button type="button" disabled={loading} onClick={() => setLoadRevision(value => value + 1)}>{copy.retry}</button> : null}
    </div> : null}</div>}
    recent={<SubtitleRecentDocuments key={userId} userId={userId} locale={locale} disabled={disabled || dirty} onOpen={id => {transcription.invalidate();render.invalidate();setSource(null);setSaved(null);setDraft(null);setRequestedDocument({id});}} />}
    preview={<div className={styles.stage}>
      {working ? <div className={styles.stageStatus} role="status"><Loader2 size={18} className={styles.spinner} aria-hidden="true" />{copy.working}</div> : null}
      {!source && !draft && !selectedStudioSource ? <CreatorInspiration locale={locale} toolId="subtitles" /> : <><div className={styles.stageHeading}><h2>{copy.transcript}</h2>{loading ? <span role="status">{copy.loading}</span> : null}</div>
        {selectedStudioSource && !source ? <div className={styles.media}><p className={styles.empty}>{copy.mixPending}</p></div> : <SubtitlePreview key={previewRevision} document={draft} source={source} locale={locale} onRefresh={saved ? () => void refreshPreview() : undefined} />}
      </>}
      {draft ? <><div className={styles.editorToolbar}><div><h2>{experience.editTitle}</h2><p role="status">{dirty ? copy.unsaved : `${copy.savedRevision} ${saved?.revision}`}</p></div>
        <button type="button" className={styles.primary} disabled={disabled || !dirty || conflict} onClick={() => void save()}><Save size={17} aria-hidden="true" />{saving ? copy.loading : dirty ? copy.save : copy.saved}</button>
      </div><SubtitleDocumentEditor locale={locale} document={draft} onChange={changeDocument} disabled={disabled || conflict} />
      <section className={styles.exportSection}><h2>{experience.exportTitle}</h2><p>{experience.exportHint}</p><div className={styles.actions}>
        <button type="button" disabled={dirty || disabled || downloadBusy} onClick={() => void download('srt')}><Download size={16} aria-hidden="true" />{copy.exportSrt}</button><button type="button" disabled={dirty || disabled || downloadBusy} onClick={() => void download('vtt')}><Download size={16} aria-hidden="true" />{copy.exportVtt}</button>
      </div>{draft.source.ref.kind === 'video' ? <CreatorOperationPanel includedExport locale={locale} operation={exportOperation} disabledReason={dirty ? copy.unsaved : !executionEnabled ? copy.executionClosed : undefined} disabled={!executionEnabled || !userId || dirty || saving || loading || uploadBusy || !draft.segments.length} action={copy.burn} onPrepare={() => {if(saved)void exportOperation.prepare({documentId:saved.id,revision:saved.revision},'/export/prepare');}} /> : <p className={styles.notice}>{copy.videoRequired}</p>}</section></> : null}
      {renderResult ? <><p className={styles.stageStatus}><CheckCircle2 size={18} aria-hidden="true" />{copy.result} · {copy.savedRevision} {renderResult.revision}</p><CreatorMediaPreview key={`${render.readRevision}:${transcription.readRevision}`} locale={locale} url={renderReadUrl ?? undefined} kind="video" poster={renderPoster} unavailable={!renderReadUrl} onRetry={retryRender} />
        <div className={styles.resultSection}><h2>{experience.resultActions}</h2><p>{experience.savedMedia} <Link href="/app/library?view=saved&kind=video" prefetch={false}>{experience.openMedia}</Link></p><div className={`${styles.actions} ${styles.resultActions}`}><button type="button" disabled={!renderReadUrl} onClick={() => {if(renderReadUrl)triggerAppDownload(renderReadUrl,`subtitles-r${renderResult!.revision}.mp4`);}}><Download size={17} aria-hidden="true" />{copy.download}</button><MediaDestinationActions presentation="creator" locale={locale} userId={userId} asset={{id:renderResult.assetId,url:renderResult.originalUrl,kind:'video',thumbUrl:renderResult.thumbnailUrl}} /></div></div></> : null}
    </div>}
  >{!executionEnabled ? <p className={styles.notice} role="status">{copy.executionClosed}</p> : null}{!userId ? <ToolAuthNotice locale={locale} path="/app/tools/subtitles" /> : null}{!selectedStudioSource ? <ToolMediaHandoff userId={userId} destination="subtitles" locale={locale} disabled={disabled} onSelect={asset => {if(asset.kind !== 'audio' && asset.kind !== 'video')throw new Error('Incompatible source');changeSource(selectCreatorSource(asset,asset.kind));setKind(asset.kind);}} /> : null}</CreatorWorkbench>;
}
