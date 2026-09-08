'use client';

import { Copy, Trash2, MoreHorizontal } from 'lucide-react';
import { useRef, useState } from 'react';
import { StudioMenu } from '../ui/StudioMenu';
import type { WorkspaceGraphNode } from '../../_lib/workspace-types';
import type { StudioCopy } from '../../../_lib/studio-copy';
import styles from '../../_styles/canvas-actions.module.css';

export function CanvasSelectionActions({ nodes, copy, onCopy, onDelete }: {
  nodes: WorkspaceGraphNode[];
  copy: StudioCopy['canvas']['nodes'];
  onCopy: () => Promise<boolean>;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyAttemptRef = useRef(0);
  const copySelection = async () => {
    const attempt = copyAttemptRef.current + 1;
    copyAttemptRef.current = attempt;
    setCopyFailed(false);
    setMenuOpen(false);
    let copied = false;
    try {
      copied = await onCopy();
    } catch {
      copied = false;
    }
    if (copyAttemptRef.current === attempt) setCopyFailed(!copied);
  };
  const handleMenuOpenChange = (open: boolean) => {
    if (open) {
      copyAttemptRef.current += 1;
      setCopyFailed(false);
    }
    setMenuOpen(open);
  };
  if (nodes.length < 2) return null;
  return <div className={styles.selectionActions} role="toolbar" aria-label={copy.selectionActions} data-canvas-selection-actions>
    <span className={styles.selectionTitle}>{`${nodes.length} ${copy.blocks}`}</span>
    <StudioMenu open={menuOpen} onOpenChange={handleMenuOpenChange} label={copy.selectionActions} className={styles.selectionMenuRoot} menuClassName={styles.selectionMenu} trigger={(triggerProps) => <button type="button" {...triggerProps}><MoreHorizontal size={16} />{copy.actions}</button>}>
      <button type="button" role="menuitem" onClick={() => void copySelection()}><Copy size={16} />{copy.copySelection}</button>
      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete(); }}><Trash2 size={16} />{copy.deleteSelection}</button>
    </StudioMenu>
    {copyFailed ? <span className={styles.copyFailure} role="alert">{copy.copyFailed}</span> : null}
  </div>;
}
