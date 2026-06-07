'use client';

import { Download, FileJson, X } from 'lucide-react';
import { useEffect } from 'react';
import styles from '../maxvideoai-editor.module.css';
import type { WorkspaceTimelineExportRangeMode, WorkspaceTimelineRenderManifest } from '../_lib/workspace-timeline-render';
import { formatWorkspaceTimecode } from '../_lib/workspace-timecode';

type WorkspaceExportDialogProps = {
  exportRangeMode: WorkspaceTimelineExportRangeMode;
  inPointSec: number | null;
  isOpen: boolean;
  manifest: WorkspaceTimelineRenderManifest;
  outPointSec: number | null;
  readinessLabel: string;
  sequenceDurationSec: number;
  onClose: () => void;
  onExportEdl: () => void;
  onPrepareRender: () => void;
  onRangeModeChange: (mode: WorkspaceTimelineExportRangeMode) => void;
};

function nullableTimecode(seconds: number | null, fps: number): string {
  return seconds === null ? '--:--:--:--' : formatWorkspaceTimecode(seconds, fps);
}

export function WorkspaceExportDialog({
  exportRangeMode,
  inPointSec,
  isOpen,
  manifest,
  outPointSec,
  readinessLabel,
  sequenceDurationSec,
  onClose,
  onExportEdl,
  onPrepareRender,
  onRangeModeChange,
}: WorkspaceExportDialogProps) {
  const fps = manifest.projectSettings?.fps ?? 24;
  const hasValidInOut = inPointSec !== null && outPointSec !== null && outPointSec > inPointSec;

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
      className={styles.sequenceSettingsOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.sequenceSettingsDialog} ${styles.exportDialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-export-title"
      >
        <div className={styles.sequenceSettingsHeader}>
          <div>
            <p id="workspace-export-title">Export sequence</p>
            <span>{readinessLabel}</span>
          </div>
          <button
            type="button"
            className={styles.sequenceSettingsCloseButton}
            onClick={onClose}
            aria-label="Close export dialog"
          >
            <X size={16} />
          </button>
        </div>
        <div className={styles.exportDialogBody}>
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
          <div className={styles.exportSummaryGrid}>
            <span>Range</span>
            <strong>{manifest.exportRange.mode === 'in-out' ? 'In/Out' : 'Sequence'}</strong>
            <span>Duration</span>
            <strong>{formatWorkspaceTimecode(manifest.durationSec, fps)}</strong>
            <span>Tracks</span>
            <strong>{manifest.tracks.length}</strong>
            <span>Status</span>
            <strong>{manifest.status === 'ready' ? 'Ready' : 'Blocked'}</strong>
          </div>
        </div>
        <div className={styles.exportDialogFooter}>
          <button type="button" className={styles.secondaryPanelButton} onClick={onExportEdl}>
            <Download size={14} />
            Export EDL
          </button>
          <button type="button" className={styles.primaryPanelButton} onClick={onPrepareRender}>
            <FileJson size={14} />
            Prepare render JSON
          </button>
        </div>
      </div>
    </div>
  );
}
