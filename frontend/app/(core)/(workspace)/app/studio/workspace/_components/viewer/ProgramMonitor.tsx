'use client';

import { Maximize2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import styles from '../../_styles/viewer.module.css';
import type { WorkspaceProjectSettings } from '../../_lib/workspace-types';
import {
  workspaceProjectAspectParts,
  workspaceProjectAspectCssValue,
  workspaceProjectDimensions,
  workspaceProjectDimensionsLabel,
} from '../../_lib/workspace-project-settings';

type ProgramZoom = 'fit' | '50' | '100';

const PROGRAM_ZOOM_OPTIONS: Array<{ value: ProgramZoom; label: string }> = [
  { value: 'fit', label: 'Fit' },
  { value: '50', label: '50%' },
  { value: '100', label: '100%' },
];

type ProgramMonitorProps = {
  activeModelLabel: string | null;
  controls: ReactNode;
  layers: ReactNode;
  playheadSec: number;
  playheadTimecode: string;
  projectSettings: WorkspaceProjectSettings;
};

export function ProgramMonitor({
  activeModelLabel,
  controls,
  layers,
  playheadSec,
  playheadTimecode,
  projectSettings,
}: ProgramMonitorProps) {
  const [programZoom, setProgramZoom] = useState<ProgramZoom>('fit');
  const projectDimensionsLabel = workspaceProjectDimensionsLabel(projectSettings);
  const programFrameStyle = useMemo(() => {
    const [aspectWidth, aspectHeight] = workspaceProjectAspectParts(projectSettings.aspectRatio);
    const dimensions = workspaceProjectDimensions(projectSettings);
    const zoomScale = programZoom === 'fit' ? 1 : Number(programZoom) / 100;
    return {
      '--workspace-project-aspect-height': aspectHeight.toString(),
      '--workspace-project-aspect-ratio': workspaceProjectAspectCssValue(projectSettings),
      '--workspace-project-aspect-width': aspectWidth.toString(),
      '--workspace-project-preview-height': `${dimensions.height}px`,
      '--workspace-project-preview-width': `${dimensions.width}px`,
      '--workspace-program-zoom-scale': zoomScale.toString(),
    } as CSSProperties;
  }, [programZoom, projectSettings]);

  return (
    <div className={styles.programMonitor} data-testid="editor-program-monitor">
      <div className={styles.programMonitorHeader}>
        <div className={styles.programMonitorTitle}>
          <span>Program</span>
          <small>{projectSettings.aspectRatio} · {projectDimensionsLabel} · {projectSettings.fps} fps</small>
          {activeModelLabel ? <em className={styles.programModelPill}>{activeModelLabel}</em> : null}
        </div>
        <div className={styles.programMonitorActions}>
          <label className={styles.programZoomControl}>
            <span>Zoom</span>
            <select
              value={programZoom}
              onChange={(event) => setProgramZoom(event.currentTarget.value as ProgramZoom)}
              title="Program monitor zoom. Fit shows the whole sequence frame; 100% maps sequence pixels to preview pixels."
              aria-label="Program monitor zoom"
            >
              {PROGRAM_ZOOM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <strong>{playheadTimecode}</strong>
          <button
            type="button"
            className={styles.programFullscreenButton}
            onClick={() => setProgramZoom((current) => (current === 'fit' ? '100' : 'fit'))}
            aria-label="Toggle program zoom"
            title="Toggle program zoom"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
      <div className={styles.programFrameViewport} data-testid="editor-program-viewport">
        <div
          className={`${styles.programFrame} ${programZoom === 'fit' ? styles.programFrameFit : styles.programFrameScaled}`}
          data-testid="editor-program-frame"
          data-program-playhead={playheadSec}
          style={programFrameStyle}
        >
          {layers}
        </div>
      </div>
      {controls}
    </div>
  );
}
