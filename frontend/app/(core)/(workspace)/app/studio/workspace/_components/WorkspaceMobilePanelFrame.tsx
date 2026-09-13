'use client';

import { X } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import baseStyles from '../maxvideoai-editor.module.css';
import shellStyles from '../_styles/shell.module.css';

const styles = { ...baseStyles, ...shellStyles };

type WorkspaceMobilePanelFrameProps = {
  children: ReactNode;
  closeLabel: string;
  title: string;
  onClose: () => void;
  desktopClose?: boolean;
};

export function WorkspaceMobilePanelFrame({
  children,
  closeLabel,
  title,
  onClose,
  desktopClose = false,
}: WorkspaceMobilePanelFrameProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  return (
    <div className={styles.mobilePanelChrome} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className={`${styles.mobilePanelCloseButton} ${desktopClose ? styles.desktopPanelCloseButton : ''}`}
        data-mobile-panel-close="true"
        data-canvas-inspector-close={desktopClose || undefined}
        aria-label={closeLabel}
        onClick={onClose}
      >
        <span>{title}</span>
        <X size={16} aria-hidden="true" />
      </button>
      <div className={styles.mobilePanelContent}>
        {children}
      </div>
    </div>
  );
}
