'use client';

import { Download, FileJson, Film, X } from 'lucide-react';
import { useEffect } from 'react';
import editorStyles from '../maxvideoai-editor.module.css';
import styles from '../_styles/export.module.css';
import {
  WORKSPACE_TIMELINE_EXPORT_QUALITY_PRESETS,
  workspaceTimelineExportReadinessChecks,
  type WorkspaceTimelineExportQualityPreset,
  type WorkspaceTimelineExportRangeMode,
  type WorkspaceTimelineRenderManifest,
} from '../_lib/workspace-timeline-export';
import { formatWorkspaceTimecode } from '../_lib/workspace-timecode';

type WorkspaceExportDialogProps = {
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

function nullableTimecode(seconds: number | null, fps: number): string {
  return seconds === null ? '--:--:--:--' : formatWorkspaceTimecode(seconds, fps);
}

export function WorkspaceExportDialog({
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
  const readinessChecks = workspaceTimelineExportReadinessChecks(manifest);
  const hasBlockingChecks = readinessChecks.some((check) => check.status === 'blocking');
  const isServerJobActive = activeExportJob?.status === 'queued' || activeExportJob?.status === 'rendering';
  const exportPriceLabel = exportEstimate
    ? exportEstimate.billingKind === 'free'
      ? `Free export ${Math.max(0, exportEstimate.freeExportsRemaining)}/${exportQuota?.freeLimit ?? 2}`
      : `${exportEstimate.currency.toUpperCase()} ${(exportEstimate.amountCents / 100).toFixed(2)}`
    : isEstimateLoading
      ? 'Estimating...'
      : 'Estimate unavailable';
  const exportJobMessage = activeExportJob?.message ?? (
    activeExportJob?.status === 'queued'
      ? 'Queued on the server. A running export worker with storage access is required to render the MP4.'
      : isServerJobActive
        ? 'Server worker is rendering the MP4.'
        : null
  );
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
            <p id="workspace-export-title">Export sequence</p>
            <span>{readinessLabel}</span>
          </div>
          <button
            type="button"
            className={styles.exportCloseButton}
            onClick={onClose}
            aria-label="Close export dialog"
          >
            <X size={16} />
          </button>
        </div>
        <div className={styles.exportDialogBody}>
          <section className={styles.exportSection}>
            <div className={styles.exportSectionHeader}>
              <strong>Video export</strong>
              <span>MP4 H.264</span>
            </div>
            <div className={styles.exportSummaryGrid}>
              <span>Project</span>
              <strong>{dimensionsLabel}</strong>
              <span>Range</span>
              <strong>{manifest.exportRange.mode === 'in-out' ? 'In/Out' : 'Sequence'}</strong>
              <span>Duration</span>
              <strong>{formatWorkspaceTimecode(manifest.durationSec, fps)}</strong>
              <span>Tracks</span>
              <strong>{manifest.tracks.length}</strong>
            </div>
          </section>

          <section className={styles.exportSection}>
            <div className={styles.exportSectionHeader}>
              <strong>Range</strong>
            </div>
            <div className={styles.exportRangeOptions} role="radiogroup" aria-label="Export range">
              <label>
                <input
                  type="radio"
                  checked={exportRangeMode === 'sequence'}
                  onChange={() => onRangeModeChange('sequence')}
                />
                <span>
                  <strong>Full sequence</strong>
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
                  <strong>In/Out range</strong>
                  <small>{nullableTimecode(inPointSec, fps)} - {nullableTimecode(outPointSec, fps)}</small>
                </span>
              </label>
            </div>
          </section>

          <section className={styles.exportSection}>
            <div className={styles.exportSectionHeader}>
              <strong>Quality preset</strong>
            </div>
            <div className={styles.exportPresetGrid} role="radiogroup" aria-label="Quality preset">
              {WORKSPACE_TIMELINE_EXPORT_QUALITY_PRESETS.map((preset) => (
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
              <strong>Preflight</strong>
              <span>{manifest.status === 'ready' ? 'Ready' : 'Blocked'}</span>
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
            {isExportStarting ? 'Queueing...' : isServerJobActive ? 'Export queued' : 'Export video'}
          </button>
          <section className={`${styles.exportSection} ${styles.exportServerSection}`}>
            <div className={styles.exportSectionHeader}>
              <strong>Server render</strong>
              <span>{exportPriceLabel}</span>
            </div>
            <div className={styles.exportServerCard}>
              <div>
                <strong>{exportEstimate?.billingKind === 'paid' ? 'Paid export' : 'Server MP4'}</strong>
                <span>
                  {exportQuota
                    ? `${exportQuota.freeExportsRemaining} free server export${exportQuota.freeExportsRemaining === 1 ? '' : 's'} remaining`
                    : 'Final render job runs on MaxVideoAI servers.'}
                </span>
                {exportJobMessage ? <small>{exportJobMessage}</small> : null}
              </div>
              {activeExportJob ? (
                <div className={styles.exportJobStatus}>
                  <span>{activeExportJob.status}</span>
                  <strong>{activeExportJob.progress}%</strong>
                </div>
              ) : null}
            </div>
            {activeExportJob ? (
              <div className={styles.exportProgressTrack} aria-label="Server export progress">
                <span style={{ width: `${activeExportJob.progress}%` }} />
              </div>
            ) : null}
            {activeExportJob?.outputUrl ? (
              <a className={styles.exportDownloadLink} href={activeExportJob.outputUrl} target="_blank" rel="noreferrer">
                Download server export
              </a>
            ) : null}
          </section>
          {exportVideoFeedback ? (
            <p className={styles.exportStatusBanner} role="status">
              {exportVideoFeedback}
            </p>
          ) : null}

          <details className={styles.exportAdvancedPanel} open>
            <summary>Advanced</summary>
            <div className={styles.exportAdvancedActions}>
              <button type="button" className={editorStyles.secondaryPanelButton} disabled={hasBlockingChecks} onClick={onExportEdl}>
                <Download size={14} />
                Export EDL
              </button>
              <button type="button" className={editorStyles.secondaryPanelButton} onClick={onPrepareRender}>
                <FileJson size={14} />
                Prepare render JSON
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
