'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import baseStyles from '../maxvideoai-editor.module.css';
import shellStyles from '../_styles/shell.module.css';

const styles = { ...baseStyles, ...shellStyles };

type WorkspaceMobilePanelFrameProps = {
  children: ReactNode;
  closeLabel: string;
  title: string;
  onClose: () => void;
};

export function WorkspaceMobilePanelFrame({
  children,
  closeLabel,
  title,
  onClose,
}: WorkspaceMobilePanelFrameProps) {
  return (
    <div className={styles.mobilePanelChrome}>
      <button
        type="button"
        className={styles.mobilePanelCloseButton}
        data-mobile-panel-close="true"
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
