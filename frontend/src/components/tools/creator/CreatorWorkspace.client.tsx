'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Download, Loader2, Plus, RotateCcw } from 'lucide-react';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { CREATOR_DEFAULT_SETTINGS, creatorOperationInputSchema, type CreatorAvailableProfile, type CreatorOperationResult, type CreatorSourceInput, type CreatorToolId } from '@/lib/toolbox/creator-tools';
import { ToolMediaHandoff } from '@/components/library/ToolMediaHandoff.client';
import { MediaDestinationActions } from '@/components/library/MediaDestinationActions.client';
import { ToolAuthNotice } from '../ToolWorkbench';
import { CreatorWorkbench, CreatorInspiration } from './CreatorWorkbench.client';
import { creatorExperienceCopy } from './creator-experience-copy';
import { CreatorSourcePicker } from './CreatorSourcePicker.client';
import { selectCreatorSource, type CreatorSource } from './creator-source-selection';
import { getCreatorLipTiming } from './creator-lip-timing';
import { CreatorSettings, CreatorSegmentFields, CreatorLipDurationSummary, creatorLipTimingMessage, type SegmentDraft } from './CreatorSettings';
import { CreatorMediaPreview } from './CreatorMediaPreview';
import { CreatorVideoComparison } from './CreatorVideoComparison.client';
import { CreatorOperationPanel } from './CreatorOperationPanel';
import { useCreatorOperation } from './useCreatorOperation';
import { creatorWorkspaceCopy } from './creator-workspace-copy';
import styles from './creator-workspace.module.css';

type CreatorReadableResult = Omit<CreatorOperationResult,'outputs'> & {outputs: Array<CreatorOperationResult['outputs'][number] & {readUrl?: string | null;thumbnailReadUrl?: string | null}>};
type Role = CreatorSourceInput['role'];
export default function CreatorWorkspace({ toolId, lipVideoEnabled = true, executionEnabled = true, initialOperationId, motionControlEnabled = false, profiles }: { toolId: CreatorToolId; lipVideoEnabled?: boolean; executionEnabled?:boolean;initialOperationId?:string;motionControlEnabled?:boolean;profiles?:CreatorAvailableProfile[] }) {
  const auth = useRequireAuth({ redirectIfLoggedOut:false }), { locale } = useI18n();
  return <CreatorSession key={`${auth.user?.id ?? 'guest'}:${toolId}:${initialOperationId ?? ''}`} userId={auth.user?.id} locale={locale} toolId={toolId} lipVideoEnabled={lipVideoEnabled} executionEnabled={executionEnabled} initialOperationId={initialOperationId} motionControlEnabled={motionControlEnabled} profiles={profiles} />;
}
export function CreatorSession({ toolId, userId, locale, lipVideoEnabled = true, executionEnabled = true, initialOperationId, motionControlEnabled = false, profiles }: { toolId: CreatorToolId; userId?: string; locale: string; lipVideoEnabled?: boolean; executionEnabled?:boolean; initialOperationId?:string;motionControlEnabled?:boolean;profiles?:CreatorAvailableProfile[] }) {
  const copy = creatorWorkspaceCopy(locale), experience = creatorExperienceCopy(locale), operation = useCreatorOperation<CreatorReadableResult>({ userId,toolId,family:'creator',executionEnabled,initialOperationId });
  const [motionProfileId,setMotionProfileId] = useState(motionControlEnabled ? 'motion-kling-v3-v1' : 'motion-wan-reference-v1');
  const [settings,setSettings] = useState<Record<string,string>>(() => ({ ...CREATOR_DEFAULT_SETTINGS[toolId] }));
  const [sources,setSources] = useState<Partial<Record<Role,CreatorSource>>>({}), [segments,setSegments] = useState<Partial<Record<Role,SegmentDraft>>>({});
  const [uploadBusy,setUploadBusy] = useState(false), [view,setView] = useState<'source'|'result'|'compare'>(toolId === 'product-video-editor' ? 'compare' : 'result');
  const [validation,setValidation] = useState(false), [unavailableSources,setUnavailableSources] = useState<Role[]>([]);
  useEffect(() => {
    const snapshot = operation.readContext, input = creatorOperationInputSchema.safeParse(snapshot?.input);
    if (!snapshot?.sourceMedia || !input.success || input.data.toolId !== toolId) return;
    const restored:Partial<Record<Role,CreatorSource>> = {}, ranges:Partial<Record<Role,SegmentDraft>> = {}, missing:Role[] = [];
    for (const item of snapshot.sourceMedia) {
      if (item.readUrl) restored[item.role] = {ref:item.ref,url:item.readUrl,name:item.name ?? copy.source,thumbnailUrl:item.thumbnailReadUrl,durationSec:item.durationSec};
      else missing.push(item.role);
      if (item.segment) ranges[item.role] = {enabled:true,start:String(item.segment.startSec),end:String(item.segment.endSec)};
    }
    setSources(restored); setSegments(ranges); setUnavailableSources(missing); setSettings({...input.data.settings});
    if (input.data.toolId === 'motion-transfer' && input.data.profileId) setMotionProfileId(input.data.profileId);
  }, [operation.readContext,toolId,copy.source]);
  const disabled = operation.busy || operation.running || uploadBusy;
  const photo = toolId === 'product-photo-editor', lip = toolId === 'lip-sync', motion = toolId === 'motion-transfer';
  const profileId = motion ? motionProfileId : lip ? settings.mode === 'video' ? 'lip-video-wan-v1' : 'lip-photo-wan-v1' : photo ? settings.model === 'nano-banana-2' ? 'product-photo-nano-v1' : 'product-photo-gpt-v1' : 'product-video-wan-v1';
  const profile = profiles?.find(value => value.id === profileId);
  const sourceKind = toolId === 'product-video-editor' || (lip && settings.mode === 'video') ? 'video' : 'image';
  const output = operation.result?.outputs[0], source = sources.source;
  const outputReadUrl = output?.readUrl === undefined ? output?.originalUrl : output.readUrl;
  const outputPoster = output?.thumbnailReadUrl === undefined ? output?.thumbnailUrl : output.thumbnailReadUrl;
  useEffect(() => { if (operation.result) setView(toolId === 'product-video-editor' ? 'compare' : 'result'); }, [operation.result,toolId]);
  const videoClosed = lip && settings.mode === 'video' && !lipVideoEnabled;
  function changed() { operation.invalidate(); setValidation(false); }
  function changeSettings(patch: Record<string,string>) {
    if (disabled) return; changed(); setSettings(value => ({ ...value,...patch,...patch.mode === 'video' ? {instruction:''} : {} }));
    if (patch.mode) { setSources(value => ({ ...value,source:undefined })); setSegments(value => ({ ...value,source:undefined })); }
  }
  function changeSource(role: Role, next: CreatorSource | null) {
    if (operation.running) return; changed(); setUnavailableSources(value => value.filter(entry => entry !== role)); setSources(value => ({ ...value,[role]:next ?? undefined })); setSegments(value => ({ ...value,[role]:undefined }));
  }
  const inputs = Object.entries(sources).flatMap(([role,selected]) => {
    if (!selected) return [];
    const range = segments[role as Role];
    return [{ role,source:selected.ref,...range?.enabled ? { segment:{startSec:range.start === '' ? NaN : Number(range.start),endSec:range.end === '' ? NaN : Number(range.end)} } : {} }];
  });
  const block = creatorOperationInputSchema.safeParse({ version:1,toolId,profileId,inputs,settings });
  const lipTiming = lip ? getCreatorLipTiming(settings.mode, sources, segments) : undefined;
  const timingError = lipTiming ? creatorLipTimingMessage(locale, lipTiming) : undefined;
  const sourceLabel = photo ? experience.photoSource : lip ? sourceKind === 'video' ? experience.lipVideoSource : experience.portraitSource : motion ? experience.characterSource : experience.videoSource;
  const sourceHint = photo ? experience.photoHint : lip ? sourceKind === 'video' ? experience.videoHint : experience.faceHint : motion ? experience.characterHint : experience.videoHint;
  const disabledReason = !userId ? copy.signIn : !executionEnabled ? copy.executionClosed : videoClosed ? copy.videoClosed : profile?.deploymentGateOpen === false ? copy.unavailable : !source ? experience.chooseSource : lip && !sources.audio ? experience.needAudio : motion && !sources.motion ? experience.needMotion : !block.success ? copy.validation : timingError;
  const sourcePicker = (role: Role,kind: 'image'|'video'|'audio') => <div key={role}>
    <CreatorSourcePicker userId={userId} locale={locale} kind={kind} label={role === 'source' ? sourceLabel : copy.sourceLabels[role]} hint={role === 'source' ? sourceHint : role === 'audio' ? experience.audioHint : role === 'motion' ? experience.motionHint : experience.styleHint} source={sources[role] ?? null} disabled={disabled}
      onChange={next => changeSource(role,next)} onBusyChange={busy => { setUploadBusy(busy); if (busy) changed(); }} />
    {unavailableSources.includes(role) ? <p role="status" className={styles.notice}>{copy.sourceUnavailable}</p> : null}
    {kind !== 'image' && sources[role] ? <CreatorSegmentFields locale={locale} role={role} source={sources[role]!} value={segments[role]} disabled={disabled} onChange={range => { changed(); setSegments(value => ({ ...value,[role]:range })); }} /> : null}
  </div>;
  const displayedResult = view !== 'source' && output;
  const canCompare = toolId === 'product-video-editor' && source && output?.kind === 'video' && outputReadUrl;
  const selectedRange = segments.source?.enabled ? segments.source : undefined;
  return <CreatorWorkbench locale={locale} toolId={toolId} title={copy.titles[toolId]} activeStep={output || operation.running ? 2 : source ? 1 : 0}
    source={<div className={styles.sourceGroup} data-paired={lip || motion}>{lip ? <div className={styles.segmented}>{(['photo','video'] as const).map(mode => <button type="button" key={mode} aria-pressed={settings.mode === mode} disabled={disabled} onClick={() => changeSettings({mode})}>{copy[mode]}</button>)}</div> : null}
      {sourcePicker('source',sourceKind)}{lip ? sourcePicker('audio','audio') : motion ? sourcePicker('motion','video') : photo ? <details className={styles.optionalSource}><summary><Plus size={16} aria-hidden="true" />{experience.addStyle}</summary>{sourcePicker('style','image')}</details> : null}
      {lipTiming ? <CreatorLipDurationSummary locale={locale} timing={lipTiming} video={settings.mode === 'video'} disabled={disabled} onAdapt={ranges => { if (disabled) return; changed(); setSegments(value => ({...value,...ranges})); }} /> : null}
      <p className={styles.notice}>{copy.preserved}</p>
    </div>}
    settings={<div className={styles.settings}><CreatorSettings locale={locale} toolId={toolId} settings={settings} onChange={changeSettings} disabled={disabled} profile={profile} motionProfileId={motionProfileId} motionControlEnabled={motionControlEnabled} onMotionProfileChange={id => {changed();setMotionProfileId(id);if(id === 'motion-kling-v3-v1')setSettings(value => ({...value,resolution:'720p'}));}} />
      {videoClosed ? null : lip || motion || toolId === 'product-video-editor' ? <p className={styles.notice}>{lip ? settings.mode === 'video' ? copy.lipVideoRange : copy.lipRange : motion && motionProfileId === 'motion-kling-v3-v1' ? `${copy.motionRange} 2–${profile?.constraints.duration?.maxByOrientation?.[settings.orientation as 'image'|'video'] ?? (settings.orientation === 'image' ? 10 : 30)} ${copy.seconds}.` : copy.segmentRequired}</p> : null}
      {validation ? <p className={styles.error} role="alert">{copy.validation}</p> : null}
      <CreatorOperationPanel locale={locale} operation={operation} disabledReason={disabledReason} disabled={!executionEnabled || !userId || uploadBusy || videoClosed || profile?.deploymentGateOpen === false || !block.success || Boolean(timingError)} onPrepare={() => { if (!block.success || timingError) {setValidation(true);return;} void operation.prepare(block.data); }} />
    </div>}
    preview={<div className={styles.stage}>{operation.running ? <div className={styles.stageStatus} role="status"><Loader2 size={18} className={styles.spinner} aria-hidden="true" />{operation.needsAttention ? copy.verifying : copy.working}</div> : output ? <div className={styles.stageStatus} role="status"><CheckCircle2 size={18} aria-hidden="true" />{experience.resultReady}</div> : null}{source || output ? <><div className={styles.stageHeading}><div className={styles.segmented}>
      {(['source','result'] as const).map(mode => <button type="button" key={mode} aria-pressed={(output ? view : 'source') === mode} disabled={mode === 'result' ? !output : !source} onClick={() => setView(mode)}>{mode === 'source' ? copy.original : copy.result}</button>)}
      {toolId === 'product-video-editor' ? <button type="button" aria-pressed={Boolean(canCompare && view === 'compare')} disabled={!canCompare} onClick={() => setView('compare')}>{copy.compare}</button> : null}
    </div></div>{canCompare && view === 'compare' ? <CreatorVideoComparison key={operation.readRevision} locale={locale} sourceUrl={source.url} resultUrl={outputReadUrl!} sourcePoster={source.thumbnailUrl} resultPoster={outputPoster} sourceStartSec={selectedRange ? Number(selectedRange.start) : 0} sourceEndSec={selectedRange ? Number(selectedRange.end) : undefined} onRetry={operation.running ? undefined : operation.retry} /> : <CreatorMediaPreview key={operation.readRevision} locale={locale} url={displayedResult ? outputReadUrl ?? undefined : source?.url} kind={displayedResult ? output.kind : sourceKind} poster={displayedResult ? outputPoster : source?.thumbnailUrl} name={source?.name} unavailable={Boolean(displayedResult && !outputReadUrl)} onRetry={displayedResult ? operation.retry : undefined} />}</> : <CreatorInspiration locale={locale} toolId={toolId} />}
      {sources.audio && !displayedResult ? <div className={styles.actions}><audio src={sources.audio.url} controls preload="none" aria-label={copy.audio} /></div> : null}
      {sources.motion && !displayedResult ? <><p className={styles.stageHeading}>{copy.sourceLabels.motion}</p><CreatorMediaPreview locale={locale} url={sources.motion.url} kind="video" poster={sources.motion.thumbnailUrl} /></> : null}
      {output ? <div className={styles.resultSection}><h2>{experience.resultActions}</h2><p>{experience.savedMedia} <Link href={`/app/library?view=saved&kind=${output.kind}`} prefetch={false}>{experience.openMedia}</Link></p><div className={`${styles.actions} ${styles.resultActions}`}><button type="button" disabled={!outputReadUrl} onClick={() => {if(outputReadUrl)triggerAppDownload(outputReadUrl,suggestDownloadFilename(output.originalUrl,toolId));}}><Download size={17} aria-hidden="true" />{copy.download}</button>
        <MediaDestinationActions presentation="creator" locale={locale} userId={userId} asset={{id:output.asset.type === 'asset' ? output.asset.assetId : output.asset.outputId,url:output.originalUrl,kind:output.kind,thumbUrl:output.thumbnailUrl,jobId:operation.result!.jobId,sourceOutputId:output.asset.type === 'job-output' ? output.asset.outputId : null}} />
      </div><button type="button" className={styles.startAnother} disabled={disabled} onClick={operation.reset}><RotateCcw size={16} aria-hidden="true" />{copy.newResult}</button></div> : null}
    </div>}
  >{!executionEnabled ? <p className={styles.notice} role="status">{copy.executionClosed}</p> : null}{!userId ? <ToolAuthNotice locale={locale} path={`/app/tools/${toolId}`} /> : null}
    <ToolMediaHandoff userId={userId} destination={toolId} locale={locale} disabled={disabled} onSelect={asset => {
      const role: Role = lip && asset.kind === 'audio' ? 'audio' : motion && asset.kind === 'video' ? 'motion' : 'source';
      if (lip && role === 'source') {
        if (asset.kind !== 'image' && asset.kind !== 'video') throw new Error('Incompatible source');
        changeSettings({mode:asset.kind === 'image' ? 'photo' : 'video'});
      } else if (role === 'source' && asset.kind !== sourceKind) throw new Error('Incompatible source');
      changeSource(role,selectCreatorSource(asset,asset.kind));
    }} />
  </CreatorWorkbench>;
}
