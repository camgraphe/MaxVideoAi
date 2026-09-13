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
import type { StudioCopy } from '../../../_lib/studio-copy';

type ProgramZoom = 'fit' | '50' | '100';

const PROGRAM_ZOOM_VALUES: ProgramZoom[] = [
  'fit',
  '50',
  '100',
];

type ProgramMonitorProps = {
  activeModelLabel: string | null;
  copy: StudioCopy['viewer']['monitor'];
  controls: ReactNode;
  layers: ReactNode;
  playheadSec: number;
  playheadTimecode: string;
  projectSettings: WorkspaceProjectSettings;
};

export function ProgramMonitor({
  activeModelLabel,
  copy,
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
          <span>{copy.program}</span>
          <small>{projectSettings.aspectRatio} · {projectDimensionsLabel} · {projectSettings.fps} fps</small>
          {activeModelLabel ? <em className={styles.programModelPill}>{activeModelLabel}</em> : null}
        </div>
        <div className={styles.programMonitorActions}>
          <label className={styles.programZoomControl}>
            <span>{copy.zoom}</span>
            <select
              value={programZoom}
              onChange={(event) => setProgramZoom(event.currentTarget.value as ProgramZoom)}
              title={copy.zoomTitle}
              aria-label={copy.zoomAria}
            >
              {PROGRAM_ZOOM_VALUES.map((value) => (
                <option key={value} value={value}>{value === 'fit' ? copy.fit : `${value}%`}</option>
              ))}
            </select>
          </label>
          <strong>{playheadTimecode}</strong>
          <button
            type="button"
            className={styles.programFullscreenButton}
            onClick={() => setProgramZoom((current) => (current === 'fit' ? '100' : 'fit'))}
            aria-label={copy.toggleZoom}
            title={copy.toggleZoom}
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
