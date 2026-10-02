'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Plus,Play,Pause,X,ChevronUp,ChevronDown,Trash2} from 'lucide-react';
import {useI18n} from '@/lib/i18n/I18nProvider';
import {resolveStudioCopy} from '../../../_lib/studio-copy';
import {useConversationTimeline} from '../_hooks/useConversationTimeline';
import {useWorkspaceTimelinePlayback} from '../../../workspace/_hooks/useWorkspaceTimelinePlayback';
import {useProgramPlaybackSync} from '../../../workspace/_components/viewer/useProgramPlaybackSync';
import {ProgramPlaybackLayers} from '../../../workspace/_components/viewer/ProgramPlaybackLayers';
import {applyConversationTimelineEdit,type ConversationTimelineEdit} from '@/lib/studio/conversation-timeline-editing';
import type {ImageLibraryAsset} from '@/lib/studio/image-library';
import type {WorkspaceTimelineItem} from '../../../workspace/_lib/workspace-types';
import styles from '../conversation-timeline.module.css';
import {ConversationExport} from './ConversationExport.client';
import {consumeConversationMediaRenewal} from '@/lib/studio/conversation-preview-access';
import type {StudioProjectTimelineExport} from '@/server/timeline-exports/contracts';

type Drag = {clip: WorkspaceTimelineItem;edge: 'start'|'end'|null;x: number;edit?: ConversationTimelineEdit};
export function ConversationTimeline({projectId,projectName,refreshKey,onOpenLibrary,insertion,exportAvailable = false,exportPending = false,exportJobs = [],onExportChange}: {projectId: string;projectName: string;refreshKey: unknown;onOpenLibrary: () => void;insertion?: {key: string;asset: ImageLibraryAsset} | null;exportAvailable?: boolean;exportPending?: boolean;exportJobs?: StudioProjectTimelineExport[];onExportChange: () => void}) {
  const router = useRouter();
  const {dictionary,locale} = useI18n();
  const t = useCallback((en: string,fr: string) => locale === 'fr' ? fr : en,[locale]);
  const copy = useMemo(() => resolveStudioCopy(dictionary),[dictionary]);
  const timeline = useConversationTimeline(projectId,refreshKey);
  const {view,edit} = timeline;
  const [monitor,setMonitor] = useState(false);
  const [selected,setSelected] = useState<string | null>(null);
  const [preview,setPreview] = useState<WorkspaceTimelineItem[] | null>(null);
  const [creating,setCreating] = useState(false);
  const [localError,setLocalError] = useState<string | null>(null);
  const [trimEdge,setTrimEdge] = useState<'start'|'end'>('end');
  const drag = useRef<Drag | null>(null);
  const starterKey = useRef<string | null>(null);
  const handledInsertion = useRef<string | null>(null);
  const renewalAttempts = useRef(new Set<string>());
  const items = useMemo(() => preview ?? view?.items ?? [],[preview,view]);
  const settings = timeline.view?.settings ?? {fps: 30 as const,aspectRatio: '16:9' as const,resolution: '720p' as const};
  const fps = settings.fps;
  const duration = items.reduce((end,item) => Math.max(end,item.startSec+item.durationSec),0);
  const cuts = useMemo(() => Array.from(new Set(items.flatMap(item => [item.startSec,item.startSec+item.durationSec]))).sort((a,b) => a-b),[items]);
  const playback = useWorkspaceTimelinePlayback({projectFps: fps,studioNotices: copy.notices,timelineDurationSec: duration,timelineCutPoints: cuts,onNotice: setLocalError,onResetExportRangeMode: () => {}});
  const layers = useProgramPlaybackSync({isPlaying: monitor && playback.isTimelinePlaying,items,playheadSec: playback.playheadSec,projectSettings: settings,selectedItemId: selected,onSelectItem: setSelected,onSendSnapshotToCanvas: () => {}});
  const unavailablePlayingClip = items.find(item => item.mediaKind !== 'audio' && item.mediaAccessError && item.startSec <= playback.playheadSec && item.startSec+item.durationSec > playback.playheadSec);
  useEffect(() => {
    if (!monitor || !unavailablePlayingClip) return;
    playback.stopTimelinePlayback();setMonitor(false);
    setLocalError(t('Media unavailable. You can remove this clip.','Média indisponible. Vous pouvez retirer ce clip.'));
  },[monitor,unavailablePlayingClip,playback.stopTimelinePlayback,t]);
  const pixelsPerSecond = 34;
  const width = Math.max(520,duration*pixelsPerSecond+40);
  const chosen = items.find(item => item.id === selected);
  const tracks = ['video',...Array.from(new Set(items.filter(item => item.track !== 'video').map(item => item.track))).sort()];
  useEffect(() => {
    if (!insertion || handledInsertion.current === insertion.key || !view) return;
    handledInsertion.current = insertion.key;
    const asset = insertion.asset;
    const kind = asset.kind ?? 'image';
    const seconds = kind === 'image' ? 5 : asset.durationSec;
    if (!seconds || seconds < 1) {setLocalError(t('This media needs measured duration before insertion.','Il faut mesurer la durée de ce média avant de l’insérer.'));return;}
    void edit({kind: 'insert',ref: {type: 'asset',assetId: asset.assetId,kind},startFrame: kind === 'audio' ? 0 : Math.round(duration*fps),durationFrames: Math.round(Math.min(seconds,kind === 'audio' && duration >= 1 ? duration : seconds)*fps)});
  },[insertion,view,edit,duration,fps,t]); // Explicit library selection, never auto-insert a new generation.
  function openMonitor() {if (!monitor) {renewalAttempts.current.clear();setLocalError(null);}setMonitor(true);}
  function seek(second: number) {playback.stopTimelinePlayback();playback.setPlayheadSec(Math.max(0,Math.min(duration,Math.round(second*fps)/fps)));openMonitor();}
  function closeMonitor() {playback.stopTimelinePlayback();setMonitor(false);renewalAttempts.current.clear();}
  function mediaFailure(item: WorkspaceTimelineItem) {
    playback.stopTimelinePlayback();
    if (consumeConversationMediaRenewal(item,renewalAttempts.current)) {void timeline.refresh({renewMediaId: item.id});return;}
    setMonitor(false);
    setLocalError(t('This clip could not be played. Reopen the monitor to retry, or remove it from the film.','Ce clip ne peut pas être lu. Rouvrez le moniteur pour réessayer, ou retirez-le du film.'));
  }
  function saveVolume(input: HTMLInputElement) {
    if (chosen && Number(input.value) !== (chosen.audioMix?.volume ?? 100)) void timeline.edit({kind: 'gain',clipId: chosen.id,volume: Number(input.value)});
  }
  function startDrag(event: React.PointerEvent<HTMLButtonElement>,clip: WorkspaceTimelineItem,edge: Drag['edge']) {
    if (timeline.busy) return;
    event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);setSelected(clip.id);seek(clip.startSec);drag.current = {clip,edge,x: event.clientX};
  }
  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || !timeline.view) return;
    const delta = Math.round((event.clientX-current.x)/pixelsPerSecond*fps);
    const edit: ConversationTimelineEdit = current.edge ? {kind: 'trim',clipId: current.clip.id,edge: current.edge,durationFrames: Math.max(fps,Math.round(current.clip.durationSec*fps)+(current.edge === 'start' ? -delta : delta))} : {kind: 'move',clipId: current.clip.id,startFrame: Math.max(0,Math.round(current.clip.startSec*fps)+delta)};
    current.edit = edit;
    try {setPreview(applyConversationTimelineEdit(timeline.view.items,edit,fps,[]));} catch (failure) {setLocalError(failure instanceof Error ? failure.message : 'EDIT_UNAVAILABLE');}
  }
  function endDrag() {const edit = drag.current?.edit;drag.current = null;if (edit) void timeline.edit(edit).finally(() => setPreview(null));else setPreview(null);}
  async function startFilm() {
    setCreating(true);setLocalError(null);starterKey.current ??= crypto.randomUUID();
    try {const response = await fetch('/api/studio/conversation-projects',{method: 'POST',headers: {'content-type': 'application/json'},body: JSON.stringify({name: projectName+' · Film',idempotencyKey: starterKey.current})});const result = await response.json();if (!response.ok || !result.ok) throw new Error(result.error);router.push('/app/studio/conversation/'+encodeURIComponent(result.result.projectId));}
    catch (failure) {setLocalError(failure instanceof Error ? failure.message : 'PROJECT_UNAVAILABLE');}
    finally {setCreating(false);}
  }
  if (timeline.legacy) return <footer className={styles.footer}><p>{t('Keep this project. Start a new film to use the connected timeline.','Ce projet reste conservé. Lancez un nouveau film pour utiliser la timeline connectée.')}</p><button disabled={creating} onClick={() => void startFilm()}>{t('Start a film','Commencer un film')}</button>{localError && <p role="alert">{localError}</p>}</footer>;
  return <footer className={styles.footer} data-revision={timeline.view?.data.revision} aria-label={t('Film timeline','Timeline du film')}>
    {monitor && items.length > 0 && <div className={styles.monitorRow}>
      <div className={styles.monitor} style={{aspectRatio: settings.aspectRatio.replace(':','/')}} aria-label={t('Film monitor','Moniteur du film')}>
        <ProgramPlaybackLayers copy={copy.viewer.monitor} {...layers} onMediaAccessError={mediaFailure} />
      </div>
      <button className={styles.close} aria-label={t('Collapse monitor','Replier le moniteur')} onClick={closeMonitor}><X size={16}/></button>
    </div>}
    <div className={styles.tools}>
      <button disabled={!items.length} aria-label={playback.isTimelinePlaying ? t('Pause film','Mettre le film en pause') : t('Play film','Lire le film')} onClick={() => {openMonitor();playback.handleToggleTimelinePlayback();}}>{playback.isTimelinePlaying ? <Pause size={17}/> : <Play size={17}/>}</button>
      <span>{playback.playheadSec.toFixed(1)} / {duration.toFixed(1)} s</span>
      <button disabled={!timeline.view || timeline.busy} aria-label={t('Add library media to film','Ajouter un média de la bibliothèque au film')} onClick={onOpenLibrary}><Plus size={17}/></button>
      {!!items.length && <button aria-label={monitor ? t('Collapse monitor','Replier le moniteur') : t('Open monitor','Ouvrir le moniteur')} onClick={() => monitor ? closeMonitor() : openMonitor()}>{monitor ? <ChevronDown size={17}/> : <ChevronUp size={17}/>}</button>}
      {timeline.busy && <small role="status">{t('Saving…','Enregistrement…')}</small>}
      {exportAvailable && timeline.view && <ConversationExport projectId={projectId} projectName={projectName} view={timeline.view} pending={exportPending || timeline.busy} jobs={exportJobs} onChange={onExportChange}/>}
    </div>
    <div className={styles.scroll}>
      <div className={styles.tracks} style={{width}} onClick={event => {if (items.length) seek((event.clientX-event.currentTarget.getBoundingClientRect().left)/pixelsPerSecond);}}>
        <div className={styles.ruler}>{Array.from({length: Math.ceil(width/(pixelsPerSecond*5))},(_,index) => <span key={index} style={{left: index*pixelsPerSecond*5}}>{index*5}s</span>)}</div>
        {tracks.map(track => <div key={track} className={styles.track} aria-label={track}>
          {items.filter(item => item.track === track).map(item => <div key={item.id} className={styles.clip} data-timeline-item={item.id} data-timeline-start={item.startSec} data-timeline-duration={item.durationSec} data-selected={selected === item.id} data-kind={item.mediaKind} style={{left: item.startSec*pixelsPerSecond,width: Math.max(30,item.durationSec*pixelsPerSecond)}}>
            <button className={styles.clipBody} disabled={timeline.busy} aria-label={`${t('Select clip','Sélectionner le clip')} ${item.title}`} onPointerDown={event => startDrag(event,item,null)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => {drag.current = null;setPreview(null);}} onClick={event => {event.stopPropagation();setSelected(item.id);seek(item.startSec);}}>{item.thumbnailUrl && item.mediaKind !== 'audio' ? <img src={item.thumbnailUrl} alt=""/> : null}<span>{item.title}</span></button>
            {(['start','end'] as const).map(edge => <button key={edge} className={styles.handle} data-edge={edge} aria-label={`${t('Trim','Couper')} ${edge} · ${item.title}`} disabled={timeline.busy} onPointerDown={event => startDrag(event,item,edge)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => {drag.current = null;setPreview(null);}} onClick={event => event.stopPropagation()}/>) }
          </div>)}
        </div>)}
        {!items.length && <p className={styles.empty}>{t('Your film takes shape here.','Votre film prend forme ici.')}</p>}
        {!!items.length && <div className={styles.playhead} style={{left: playback.playheadSec*pixelsPerSecond}}/>}
      </div>
    </div>
    {chosen && <div className={styles.inspector}>
      <span>{chosen.title}</span>
      <button aria-pressed={trimEdge === 'start'} onClick={() => setTrimEdge('start')}>{t('Start','Début')}</button><button aria-pressed={trimEdge === 'end'} onClick={() => setTrimEdge('end')}>{t('End','Fin')}</button>
      <input key={`${chosen.id}:${chosen.durationSec}`} type="number" min="1" step={1/fps} defaultValue={chosen.durationSec} aria-label={t('Clip duration in seconds','Durée du clip en secondes')} disabled={timeline.busy} onBlur={event => {const seconds = Number(event.target.value);if (Number.isFinite(seconds) && seconds >= 1 && seconds !== chosen.durationSec) void timeline.edit({kind: 'trim',clipId: chosen.id,edge: trimEdge,durationFrames: Math.round(seconds*fps)});}}/>
      <small>s</small>
      {(chosen.mediaKind === 'audio' || chosen.hasEmbeddedAudio) && <input key={`${chosen.id}:${chosen.audioMix?.volume}`} type="range" min="0" max="100" defaultValue={chosen.audioMix?.volume ?? 100} aria-label={t('Audio volume','Volume audio')} disabled={timeline.busy} onPointerUp={event => saveVolume(event.currentTarget)} onKeyUp={event => {if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(event.key)) saveVolume(event.currentTarget);}} onBlur={event => saveVolume(event.currentTarget)}/>}
      {chosen.mediaAccessError && <small role="alert">{t('Media unavailable. You can remove this clip.','Média indisponible. Vous pouvez retirer ce clip.')}</small>}
      <button disabled={timeline.busy} aria-label={t('Remove selected clip','Retirer le clip sélectionné')} onClick={() => {void timeline.edit({kind: 'remove',clipId: chosen.id});setSelected(null);}}><Trash2 size={15}/></button>
    </div>}
    {(timeline.error || localError) && <p className={styles.error} role="alert">{timeline.error === 'STUDIO_REVISION_CONFLICT' ? t('The film changed. Your latest edit has been kept; try again on the updated timeline.','Le film a changé. La dernière modification est conservée ; réessayez sur la timeline actualisée.') : timeline.error ?? localError}</p>}
  </footer>;
}
