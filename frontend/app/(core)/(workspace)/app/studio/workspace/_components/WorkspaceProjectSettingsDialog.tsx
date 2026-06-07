'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';
import styles from '../maxvideoai-editor.module.css';
import {
  WORKSPACE_PROJECT_ASPECT_RATIOS,
  WORKSPACE_PROJECT_FPS_OPTIONS,
  WORKSPACE_PROJECT_RESOLUTIONS,
  workspaceProjectDimensions,
  workspaceProjectDimensionsLabel,
} from '../_lib/workspace-project-settings';
import type { WorkspaceProjectSettings } from '../_lib/workspace-types';

type WorkspaceProjectSettingsDialogProps = {
  isOpen: boolean;
  projectSettings: WorkspaceProjectSettings;
  onOpenChange: (isOpen: boolean) => void;
  onProjectSettingsChange: (patch: Partial<WorkspaceProjectSettings>) => void;
};

export function WorkspaceProjectSettingsDialog({
  isOpen,
  projectSettings,
  onOpenChange,
  onProjectSettingsChange,
}: WorkspaceProjectSettingsDialogProps) {
  const projectDimensions = workspaceProjectDimensions(projectSettings);
  const projectDimensionsLabel = workspaceProjectDimensionsLabel(projectSettings);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onOpenChange(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onOpenChange]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.sequenceSettingsOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className={styles.sequenceSettingsDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-sequence-settings-title"
      >
        <div className={styles.sequenceSettingsHeader}>
          <div>
            <p id="workspace-sequence-settings-title">Project settings</p>
            <span>{projectDimensionsLabel} · {projectSettings.fps} fps</span>
          </div>
          <button
            type="button"
            className={styles.sequenceSettingsCloseButton}
            onClick={() => onOpenChange(false)}
            aria-label="Close project settings"
          >
            <X size={16} />
          </button>
        </div>
        <div className={styles.sequenceSettingsFields} aria-label="Project sequence settings">
          <label>
            <span>Aspect</span>
            <select
              value={projectSettings.aspectRatio}
              onChange={(event) => onProjectSettingsChange({ aspectRatio: event.currentTarget.value as WorkspaceProjectSettings['aspectRatio'] })}
              title="Project sequence aspect ratio"
              aria-label="Sequence aspect ratio"
            >
              {WORKSPACE_PROJECT_ASPECT_RATIOS.map((aspectRatio) => (
                <option key={aspectRatio} value={aspectRatio}>{aspectRatio}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Resolution</span>
            <select
              value={projectSettings.resolution}
              onChange={(event) => onProjectSettingsChange({ resolution: event.currentTarget.value as WorkspaceProjectSettings['resolution'] })}
              title={`Project sequence resolution: ${projectDimensions.width}x${projectDimensions.height}`}
              aria-label="Sequence resolution"
            >
              {WORKSPACE_PROJECT_RESOLUTIONS.map((resolution) => (
                <option key={resolution} value={resolution}>{resolution}</option>
              ))}
            </select>
          </label>
          <label>
            <span>FPS</span>
            <select
              value={projectSettings.fps}
              onChange={(event) => onProjectSettingsChange({ fps: Number(event.currentTarget.value) as WorkspaceProjectSettings['fps'] })}
              title="Project sequence frames per second"
              aria-label="Sequence FPS"
            >
              {WORKSPACE_PROJECT_FPS_OPTIONS.map((fps) => (
                <option key={fps} value={fps}>{fps}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
