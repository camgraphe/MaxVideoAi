'use client';
import { useState } from 'react';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { CREATOR_DEFAULT_SETTINGS, creatorOperationInputSchema, type CreatorOperationResult, type CreatorSourceInput, type CreatorToolId } from '@/lib/toolbox/creator-tools';
import { ToolMediaHandoff } from '@/components/library/ToolMediaHandoff.client';
import { MediaDestinationActions } from '@/components/library/MediaDestinationActions.client';
import { ToolAuthNotice, ToolWorkbench } from '../ToolWorkbench';
import { CreatorSourcePicker } from './CreatorSourcePicker.client';
import { selectCreatorSource, type CreatorSource } from './creator-source-selection';
import { CreatorSettings, CreatorSegmentFields, type SegmentDraft } from './CreatorSettings';
import { CreatorMediaPreview } from './CreatorMediaPreview';
import { CreatorOperationPanel } from './CreatorOperationPanel';
import { useCreatorOperation } from './useCreatorOperation';
import { creatorWorkspaceCopy } from './creator-workspace-copy';
import styles from './creator-workspace.module.css';

type CreatorReadableResult = Omit<CreatorOperationResult,'outputs'> & {outputs: Array<CreatorOperationResult['outputs'][number] & {readUrl?: string | null;thumbnailReadUrl?: string | null}>};
type Role = CreatorSourceInput['role'];
export default function CreatorWorkspace({ toolId, lipVideoEnabled = false, executionEnabled = true, initialOperationId }: { toolId: CreatorToolId; lipVideoEnabled?: boolean; executionEnabled?:boolean;initialOperationId?:string }) {
  const auth = useRequireAuth({ redirectIfLoggedOut:false }), { locale } = useI18n();
  return <CreatorSession key={`${auth.user?.id ?? 'guest'}:${toolId}:${initialOperationId ?? ''}`} userId={auth.user?.id} locale={locale} toolId={toolId} lipVideoEnabled={lipVideoEnabled} executionEnabled={executionEnabled} initialOperationId={initialOperationId} />;
}
export function CreatorSession({ toolId, userId, locale, lipVideoEnabled = false, executionEnabled = true, initialOperationId }: { toolId: CreatorToolId; userId?: string; locale: string; lipVideoEnabled?: boolean; executionEnabled?:boolean; initialOperationId?:string }) {
  const copy = creatorWorkspaceCopy(locale), operation = useCreatorOperation<CreatorReadableResult>({ userId,toolId,family:'creator',executionEnabled,initialOperationId });
  const [settings,setSettings] = useState<Record<string,string>>(() => ({ ...CREATOR_DEFAULT_SETTINGS[toolId] }));
  const [sources,setSources] = useState<Partial<Record<Role,CreatorSource>>>({}), [segments,setSegments] = useState<Partial<Record<Role,SegmentDraft>>>({});
  const [uploadBusy,setUploadBusy] = useState(false), [view,setView] = useState<'source'|'result'>('result');
  const [validation,setValidation] = useState(false);
  const disabled = operation.busy || operation.running || uploadBusy;
  const photo = toolId === 'product-photo-editor', lip = toolId === 'lip-sync', motion = toolId === 'motion-transfer';
  const sourceKind = toolId === 'product-video-editor' || (lip && settings.mode === 'video') ? 'video' : 'image';
  const output = operation.result?.outputs[0], source = sources.source;
  const outputReadUrl = output?.readUrl === undefined ? output?.originalUrl : output.readUrl;
  const outputPoster = output?.thumbnailReadUrl === undefined ? output?.thumbnailUrl : output.thumbnailReadUrl;
  const videoClosed = lip && settings.mode === 'video' && !lipVideoEnabled;
  function changed() { operation.invalidate(); setValidation(false); }
  function changeSettings(patch: Record<string,string>) {
    if (disabled) return; changed(); setSettings(value => ({ ...value,...patch }));
    if (patch.mode) { setSources(value => ({ ...value,source:undefined })); setSegments(value => ({ ...value,source:undefined })); }
  }
  function changeSource(role: Role, next: CreatorSource | null) {
    if (operation.running) return; changed(); setSources(value => ({ ...value,[role]:next ?? undefined })); setSegments(value => ({ ...value,[role]:undefined }));
  }
  const inputs = Object.entries(sources).flatMap(([role,selected]) => {
    if (!selected) return [];
    const range = segments[role as Role];
    return [{ role,source:selected.ref,...range?.enabled ? { segment:{startSec:range.start === '' ? NaN : Number(range.start),endSec:range.end === '' ? NaN : Number(range.end)} } : {} }];
  });
  const block = creatorOperationInputSchema.safeParse({ version:1,toolId,inputs,settings });
  const sourcePicker = (role: Role,kind: 'image'|'video'|'audio') => <div key={role}>
    <CreatorSourcePicker userId={userId} locale={locale} kind={kind} label={copy.sourceLabels[role]} source={sources[role] ?? null} disabled={disabled}
      onChange={next => changeSource(role,next)} onBusyChange={busy => { setUploadBusy(busy); if (busy) changed(); }} />
    {kind !== 'image' && sources[role] ? <CreatorSegmentFields locale={locale} role={role} source={sources[role]!} value={segments[role]} disabled={disabled} onChange={range => { changed(); setSegments(value => ({ ...value,[role]:range })); }} /> : null}
  </div>;
  const displayedResult = view === 'result' && output;
  return <ToolWorkbench locale={locale} title={copy.titles[toolId]}
    source={<div className={styles.sourceGroup}>{lip ? <div className={styles.segmented}>{(['photo','video'] as const).map(mode => <button type="button" key={mode} aria-pressed={settings.mode === mode} disabled={disabled} onClick={() => changeSettings({mode})}>{copy[mode]}</button>)}</div> : null}
      {sourcePicker('source',sourceKind)}{lip ? sourcePicker('audio','audio') : motion ? sourcePicker('motion','video') : photo ? sourcePicker('style','image') : null}
      <p className={styles.notice}>{copy.preserved}</p>
    </div>}
    settings={<div className={styles.settings}><CreatorSettings locale={locale} toolId={toolId} settings={settings} onChange={changeSettings} disabled={disabled} />
      {videoClosed ? <p role="status" className={styles.notice}>{copy.videoClosed}</p> : lip || motion || toolId === 'product-video-editor' ? <p className={styles.notice}>{lip ? copy.lipRange : copy.segmentRequired}</p> : null}
      {validation ? <p className={styles.error} role="alert">{copy.validation}</p> : null}
      <CreatorOperationPanel locale={locale} operation={operation} disabled={!executionEnabled || !userId || uploadBusy || videoClosed || !block.success} onPrepare={() => { if (!block.success) {setValidation(true);return;} void operation.prepare(block.data); }} />
    </div>}
    preview={<div className={styles.stage}><div className={styles.stageHeading}><div className={styles.segmented}>
      {(['source','result'] as const).map(mode => <button type="button" key={mode} aria-pressed={(output ? view : 'source') === mode} disabled={mode === 'result' ? !output : !source} onClick={() => setView(mode)}>{mode === 'source' ? copy.original : copy.result}</button>)}
    </div></div><CreatorMediaPreview locale={locale} url={displayedResult ? outputReadUrl ?? undefined : source?.url} kind={displayedResult ? output.kind : sourceKind} poster={displayedResult ? outputPoster : source?.thumbnailUrl} name={source?.name} unavailable={Boolean(displayedResult && !outputReadUrl)} onRetry={displayedResult ? operation.retry : undefined} />
      {sources.audio ? <div className={styles.actions}><audio src={sources.audio.url} controls preload="none" aria-label={copy.audio} /></div> : null}
      {sources.motion && !displayedResult ? <><p className={styles.stageHeading}>{copy.sourceLabels.motion}</p><CreatorMediaPreview locale={locale} url={sources.motion.url} kind="video" poster={sources.motion.thumbnailUrl} /></> : null}
      {output ? <div className={styles.actions}><button type="button" disabled={!outputReadUrl} onClick={() => {if(outputReadUrl)triggerAppDownload(outputReadUrl,suggestDownloadFilename(output.originalUrl,toolId));}}>{copy.download}</button>
        <MediaDestinationActions locale={locale} userId={userId} asset={{id:output.asset.type === 'asset' ? output.asset.assetId : output.asset.outputId,url:output.originalUrl,kind:output.kind,thumbUrl:output.thumbnailUrl,jobId:operation.result!.jobId,sourceOutputId:output.asset.type === 'job-output' ? output.asset.outputId : null}} />
      </div> : null}
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
  </ToolWorkbench>;
}
