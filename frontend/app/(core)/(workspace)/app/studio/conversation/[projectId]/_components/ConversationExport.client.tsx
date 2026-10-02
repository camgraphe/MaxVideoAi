'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Download,X} from 'lucide-react';
import {useI18n} from '@/lib/i18n/I18nProvider';
import {resolveStudioCopy} from '../../../_lib/studio-copy';
import {useExportController,normalizeTimelineExportClientJob} from '../../../workspace/_controllers/useExportController';
import {buildWorkspaceTimelineRenderManifest} from '../../../workspace/_lib/workspace-timeline-render';
import type {WorkspaceTimelineExportQualityPreset} from '../../../workspace/_lib/workspace-timeline-export';
import type {ConversationTimelineView} from '../_hooks/useConversationTimeline';
import styles from '../conversation-timeline.module.css';
import type {StudioProjectTimelineExport} from '@/server/timeline-exports/contracts';
import type {TimelineExportClientJob} from '../../../workspace/_state/workspace-state';

export function ConversationExport({projectId,projectName,view,pending,jobs,onChange}: {projectId: string;projectName: string;view: ConversationTimelineView;pending: boolean;jobs: StudioProjectTimelineExport[];onChange: () => void}) {
  const {dictionary,locale} = useI18n();
  const t = (en: string,fr: string) => locale === 'fr' ? fr : en;
  const copy = useMemo(() => resolveStudioCopy(dictionary),[dictionary]);
  const [quality,setQuality] = useState<WorkspaceTimelineExportQualityPreset>('draft');
  const [notice,setNotice] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const manifest = useMemo(() => buildWorkspaceTimelineRenderManifest({items: view.items,nodes: [],projectName,sequenceId: view.data.sequenceId,sequenceName: view.data.sequenceName,projectSettings: view.settings,createdAt: view.data.updatedAt}),[view,projectName]);
  const recoveredJobs = useMemo(() => jobs.flatMap(job => {const normalized = normalizeTimelineExportClientJob(job);return normalized ? [{...normalized,idempotencyKey: job.idempotencyKey}] : [];}) as (TimelineExportClientJob & {idempotencyKey: string})[],[jobs]);
  const controller = useExportController({manifest,projectId,qualityPreset: quality,copy: copy.exportDialog,notices: copy.notices,onNotice: setNotice,recoveredJobs});
  useEffect(() => {if (controller.isExportDialogOpen) dialog.current?.showModal();else dialog.current?.close();},[controller.isExportDialogOpen]);
  useEffect(() => {if (controller.activeExportJob) onChange();},[controller.activeExportJob,onChange]);
  const formatPrice = (estimate: typeof controller.exportEstimate) => estimate ? estimate.amountCents === 0 ? t('Free','Gratuit') : estimate.currency.toUpperCase()+' '+(estimate.amountCents/100).toFixed(2) : t('Calculating…','Calcul…');
  const working = controller.activeExportJob?.status === 'queued' || controller.activeExportJob?.status === 'rendering';
  const completed = controller.activeExportJob?.status === 'completed';
  const price = (working || completed) && !controller.exportEstimate ? t('Export confirmed','Export confirmé') : formatPrice(controller.exportEstimate);
  const submissionSettings = controller.submissionManifest.projectSettings ?? view.settings;
  return <>
    <button disabled={pending || manifest.status !== 'ready'} aria-label={t('Export film','Exporter le film')} onClick={controller.openExportDialog}><Download size={17}/></button>
    <dialog ref={dialog} className={styles.exportDialog} onCancel={controller.closeExportDialog}>
      <div className={styles.exportHeading}><strong>{t('Your film','Votre film')}</strong><button aria-label={t('Close export','Fermer l’export')} onClick={controller.closeExportDialog}><X size={16}/></button></div>
      <p>{controller.submissionManifest.durationSec.toFixed(1)} s · {submissionSettings.resolution} · {submissionSettings.aspectRatio} · {submissionSettings.fps} fps</p>
      <label>{t('Quality','Qualité')} <select value={controller.submissionQualityPreset} disabled={working || completed || controller.submissionPending} onChange={event => setQuality(event.target.value as WorkspaceTimelineExportQualityPreset)}><option value="draft">{t('Draft','Brouillon')}</option><option value="standard">Standard</option><option value="high">{t('High','Haute')}</option></select></label>
      <p>{controller.submissionPending && controller.submittedExportEstimate ? `${t('Original quote','Devis initial')} · ${formatPrice(controller.submittedExportEstimate)}` : price}</p>
      {notice && <p role="status">{notice}</p>}
      {manifest.issues.filter(issue => issue.severity === 'blocking').map(issue => <p key={issue.code+issue.itemId}>{issue.message}</p>)}
      {completed ? <button onClick={controller.closeExportDialog}>{t('Back to Studio','Retour au Studio')}</button> : <button disabled={!controller.isExportEstimateReady || controller.isExportEstimateLoading || controller.isExportVideoStarting || working || pending || controller.submissionManifest.status !== 'ready'} onClick={() => void controller.exportTimelineVideo()}>{controller.isExportVideoStarting || working ? t('Preparing film…','Préparation du film…') : `${controller.submissionPending ? t('Resume export','Reprendre l’export') : t('Confirm export','Confirmer l’export')} · ${price}`}</button>}
      {controller.exportVideoFeedback && <p role="status">{controller.exportVideoFeedback}</p>}
    </dialog>
  </>;
}
