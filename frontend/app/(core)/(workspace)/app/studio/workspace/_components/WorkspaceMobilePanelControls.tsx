'use client';

import { PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import styles from '../_styles/shell.module.css';

type MobilePanel = 'media' | 'inspector' | null;

type WorkspaceMobilePanelControlsProps = {
  activePanel: MobilePanel;
  ariaLabel: string;
  inspectorLabel: string;
  mediaLabel: string;
  showInspector: boolean;
  showMedia: boolean;
  onTogglePanel: (panel: Exclude<MobilePanel, null>, trigger: HTMLButtonElement) => void;
};

export function WorkspaceMobilePanelControls({
  activePanel,
  ariaLabel,
  inspectorLabel,
  mediaLabel,
  showInspector,
  showMedia,
  onTogglePanel,
}: WorkspaceMobilePanelControlsProps) {
  if (!showMedia && !showInspector) return null;

  return (
    <nav className={styles.mobilePanelRail} aria-label={ariaLabel}>
      {showMedia ? (
        <button
          type="button"
          className={activePanel === 'media' ? styles.mobilePanelButtonActive : styles.mobilePanelButton}
          aria-controls="studio-project-media-panel"
          aria-expanded={activePanel === 'media'}
          onClick={(event) => onTogglePanel('media', event.currentTarget)}
        >
          <PanelLeftOpen size={16} aria-hidden="true" />
          <span>{mediaLabel}</span>
        </button>
      ) : null}
      {showInspector ? (
        <button
          type="button"
          className={activePanel === 'inspector' ? styles.mobilePanelButtonActive : styles.mobilePanelButton}
          aria-controls="studio-inspector-panel"
          aria-expanded={activePanel === 'inspector'}
          onClick={(event) => onTogglePanel('inspector', event.currentTarget)}
        >
          <PanelRightOpen size={16} aria-hidden="true" />
          <span>{inspectorLabel}</span>
        </button>
      ) : null}
    </nav>
  );
}
