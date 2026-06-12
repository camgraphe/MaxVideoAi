'use client';

import { Download, FileJson, Film, X } from 'lucide-react';
import { useEffect } from 'react';
import editorStyles from '../maxvideoai-editor.module.css';
import styles from '../_styles/export.module.css';
import {
  workspaceTimelineExportQualityPresetOptions,
  workspaceTimelineExportReadinessChecks,
  type WorkspaceTimelineExportQualityPreset,
  type WorkspaceTimelineExportRangeMode,
  type WorkspaceTimelineRenderManifest,
} from '../_lib/workspace-timeline-export';
import { formatWorkspaceTimecode } from '../_lib/workspace-timecode';
import type { StudioCopy } from '../../_lib/studio-copy';

type WorkspaceExportDialogProps = {
  copy: StudioCopy['exportDialog'];
  activeExportJob: {
    id: string;
    status: 'queued' | 'rendering' | 'completed' | 'failed' | 'canceled';
    progress: number;
    message: string | null;
    outputUrl: string | null;
  } | null;
  exportEstimate: {
    billingKind: 'free' | 'paid';
    amountCents: number;
    currency: string;
    freeExportsRemaining: number;
  } | null;
  exportQuota: {
    freeLimit: number;
    usedFreeExports: number;
    freeExportsRemaining: number;
    billingKind: 'free' | 'paid';
  } | null;
  exportRangeMode: WorkspaceTimelineExportRangeMode;
  exportQualityPreset: WorkspaceTimelineExportQualityPreset;
  exportVideoFeedback: string | null;
  inPointSec: number | null;
  isEstimateLoading: boolean;
  isExportStarting: boolean;
  isOpen: boolean;
  manifest: WorkspaceTimelineRenderManifest;
  outPointSec: number | null;
  readinessLabel: string;
  sequenceDurationSec: number;
  onClose: () => void;
  onExportEdl: () => void;
  onExportVideo: () => void;
  onPrepareRender: () => void;
  onQualityPresetChange: (preset: WorkspaceTimelineExportQualityPreset) => void;
  onRangeModeChange: (mode: WorkspaceTimelineExportRangeMode) => void;
};

function formatCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function exportJobStatusLabel(
  status: NonNullable<WorkspaceExportDialogProps['activeExportJob']>['status'],
  copy: StudioCopy['exportDialog']
): string {
  switch (status) {
    case 'queued':
      return copy.queued;
    case 'rendering':
      return copy.rendering;
    case 'completed':
      return copy.ready;
    case 'failed':
      return copy.failed;
    case 'canceled':
      return copy.canceled;
  }
}

function nullableTimecode(seconds: number | null, fps: number): string {
  return seconds === null ? '--:--:--:--' : formatWorkspaceTimecode(seconds, fps);
}

export function WorkspaceExportDialog({
  copy,
  activeExportJob,
  exportEstimate,
  exportQuota,
  exportRangeMode,
  exportQualityPreset,
  exportVideoFeedback,
  inPointSec,
  isEstimateLoading,
  isExportStarting,
  isOpen,
  manifest,
  outPointSec,
  readinessLabel,
  sequenceDurationSec,
  onClose,
  onExportEdl,
  onExportVideo,
  onPrepareRender,
  onQualityPresetChange,
  onRangeModeChange,
}: WorkspaceExportDialogProps) {
  const fps = manifest.projectSettings?.fps ?? 24;
  const hasValidInOut = inPointSec !== null && outPointSec !== null && outPointSec > inPointSec;
  const qualityPresets = workspaceTimelineExportQualityPresetOptions(copy);
  const readinessChecks = workspaceTimelineExportReadinessChecks(manifest, copy);
  const hasBlockingChecks = readinessChecks.some((check) => check.status === 'blocking');
  const isServerJobActive = activeExportJob?.status === 'queued' || activeExportJob?.status === 'rendering';
  const exportPriceLabel = exportEstimate
    ? exportEstimate.billingKind === 'free'
      ? formatCopyValue(copy.freeExport, {
        remaining: Math.max(0, exportEstimate.freeExportsRemaining),
        limit: exportQuota?.freeLimit ?? 2,
      })
      : `${exportEstimate.currency.toUpperCase()} ${(exportEstimate.amountCents / 100).toFixed(2)}`
    : isEstimateLoading
      ? copy.estimating
      : copy.estimateUnavailable;
  const exportJobMessage =
    activeExportJob?.status === 'queued'
      ? copy.queuedServerWorker
      : activeExportJob?.status === 'rendering'
        ? copy.serverWorkerRendering
        : activeExportJob?.status === 'completed'
          ? copy.ready
          : activeExportJob?.status === 'failed'
            ? activeExportJob.message ?? copy.exportCreateFailed
            : activeExportJob?.status === 'canceled'
              ? copy.canceled
              : null;
  const dimensionsLabel = manifest.projectSettings
    ? `${manifest.projectSettings.aspectRatio} · ${manifest.projectSettings.resolution} · ${manifest.projectSettings.fps} fps`
    : `${fps} fps`;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.exportOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.exportDialogShell} ${styles.exportDialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-export-title"
      >
        <div className={styles.exportHeader}>
          <div>
            <p id="workspace-export-title">{copy.title}</p>
            <span>{readinessLabel}</span>
          </div>
          <button
            type="button"
            className={styles.exportCloseButton}
            onClick={onClose}
            aria-label={copy.close}
          >
            <X size={16} />
          </button>
        </div>
        <div className={styles.exportDialogBody}>
          <section className={styles.exportSection}>
            <div className={styles.exportSectionHeader}>
              <strong>{copy.videoExport}</strong>
              <span>{copy.formatMp4}</span>
            </div>
            <div className={styles.exportSummaryGrid}>
              <span>{copy.sequence}</span>
              <strong>{manifest.sequenceName}</strong>
              <span>{copy.project}</span>
              <strong>{dimensionsLabel}</strong>
              <span>{copy.range}</span>
              <strong>{manifest.exportRange.mode === 'in-out' ? copy.inOut : copy.fullSequenceRange}</strong>
              <span>{copy.duration}</span>
              <strong>{formatWorkspaceTimecode(manifest.durationSec, fps)}</strong>
              <span>{copy.tracks}</span>
              <strong>{manifest.tracks.length}</strong>
            </div>
          </section>

          <section className={styles.exportSection}>
            <div className={styles.exportSectionHeader}>
              <strong>{copy.range}</strong>
            </div>
            <div className={styles.exportRangeOptions} role="radiogroup" aria-label={copy.exportRange}>
              <label>
                <input
                  type="radio"
                  checked={exportRangeMode === 'sequence'}
                  onChange={() => onRangeModeChange('sequence')}
                />
                <span>
                  <strong>{copy.fullSequence}</strong>
                  <small>{formatWorkspaceTimecode(0, fps)} - {formatWorkspaceTimecode(sequenceDurationSec, fps)}</small>
                </span>
              </label>
              <label className={!hasValidInOut ? styles.exportRangeDisabled : undefined}>
                <input
                  type="radio"
                  checked={exportRangeMode === 'in-out'}
                  disabled={!hasValidInOut}
                  onChange={() => onRangeModeChange('in-out')}
                />
                <span>
                  <strong>{copy.inOutRange}</strong>
                  <small>{nullableTimecode(inPointSec, fps)} - {nullableTimecode(outPointSec, fps)}</small>
                </span>
              </label>
            </div>
          </section>

          <section className={styles.exportSection}>
            <div className={styles.exportSectionHeader}>
              <strong>{copy.qualityPreset}</strong>
            </div>
            <div className={styles.exportPresetGrid} role="radiogroup" aria-label={copy.qualityPreset}>
              {qualityPresets.map((preset) => (
                <label
                  key={preset.id}
                  className={`${styles.exportPresetCard} ${exportQualityPreset === preset.id ? styles.exportPresetCardActive : ''}`}
                >
                  <input
                    type="radio"
                    checked={exportQualityPreset === preset.id}
                    onChange={() => onQualityPresetChange(preset.id)}
                  />
                  <span>
                    <strong>{preset.label}</strong>
                    <small>{preset.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className={styles.exportSection}>
            <div className={styles.exportSectionHeader}>
              <strong>{copy.preflight}</strong>
              <span>{manifest.status === 'ready' ? copy.ready : copy.blocked}</span>
            </div>
            <div className={styles.exportReadinessList}>
              {readinessChecks.map((check) => (
                <div key={check.id} className={styles.exportReadinessItem} data-status={check.status}>
                  <strong>{check.label}</strong>
                  <span>{check.message}</span>
                </div>
              ))}
            </div>
          </section>

          <button
            type="button"
            className={`${editorStyles.primaryPanelButton} ${styles.exportPrimaryAction}`}
            disabled={hasBlockingChecks || isExportStarting || isServerJobActive}
            onClick={onExportVideo}
          >
            <Film size={15} />
            {isExportStarting ? copy.queueing : isServerJobActive ? copy.exportQueued : activeExportJob?.status === 'failed' ? copy.retryExport : copy.exportVideo}
          </button>
          <section className={`${styles.exportSection} ${styles.exportServerSection}`}>
            <div className={styles.exportSectionHeader}>
              <strong>{copy.serverRender}</strong>
              <span>{exportPriceLabel}</span>
            </div>
            <div className={styles.exportServerCard} data-status={activeExportJob?.status ?? 'idle'}>
              <div>
                <strong>{exportEstimate?.billingKind === 'paid' ? copy.paidExport : copy.serverMp4}</strong>
                <span>
                  {exportQuota
                    ? formatCopyValue(
                      exportQuota.freeExportsRemaining === 1 ? copy.freeExportsRemaining : copy.freeExportsRemainingPlural,
                      { count: exportQuota.freeExportsRemaining }
                    )
                    : copy.finalRenderJob}
                </span>
                {exportJobMessage ? <small>{exportJobMessage}</small> : null}
              </div>
              {activeExportJob ? (
                <div className={styles.exportJobStatus} data-status={activeExportJob.status}>
                  <span>{exportJobStatusLabel(activeExportJob.status, copy)}</span>
                  <strong>{activeExportJob.progress}%</strong>
                </div>
              ) : null}
            </div>
            {activeExportJob ? (
              <div className={styles.exportProgressTrack} data-status={activeExportJob.status} aria-label={copy.serverProgress}>
                <span style={{ width: `${activeExportJob.progress}%` }} />
              </div>
            ) : null}
            {activeExportJob?.outputUrl ? (
              <a className={styles.exportDownloadLink} href={activeExportJob.outputUrl} target="_blank" rel="noreferrer">
                {copy.downloadMp4}
              </a>
            ) : null}
          </section>
          {exportVideoFeedback || activeExportJob?.status === 'failed' ? (
            <p className={styles.exportStatusBanner} role={activeExportJob?.status === 'failed' ? 'alert' : 'status'}>
              {exportVideoFeedback ?? activeExportJob?.message ?? copy.failed}
            </p>
          ) : null}

          <details className={styles.exportAdvancedPanel} open>
            <summary>{copy.advanced}</summary>
            <div className={styles.exportAdvancedActions}>
              <button type="button" className={editorStyles.secondaryPanelButton} disabled={hasBlockingChecks} onClick={onExportEdl}>
                <Download size={14} />
                {copy.exportEdl}
              </button>
              <button type="button" className={editorStyles.secondaryPanelButton} onClick={onPrepareRender}>
                <FileJson size={14} />
                {copy.prepareRenderJson}
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
