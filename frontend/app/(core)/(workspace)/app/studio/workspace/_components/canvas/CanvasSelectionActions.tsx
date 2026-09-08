'use client';

import { Copy, Settings2, Trash2, Link2, Send, Replace, MoreHorizontal } from 'lucide-react';
import { useRef, useState } from 'react';
import { StudioMenu } from '../ui/StudioMenu';
import type { WorkspaceGraphNode } from '../../_lib/workspace-types';
import { isPlayableAudioUrl, isPlayableImageUrl, isPlayableVideoUrl, outputStatus } from '../../_lib/workspace-media-availability';
import type { StudioCopy } from '../../../_lib/studio-copy';
import styles from '../../_styles/canvas-actions.module.css';

export function CanvasSelectionActions({ nodes, copy, onSettings, onConnections, onCopy, onDelete }: {
  nodes: WorkspaceGraphNode[];
  copy: StudioCopy['canvas']['nodes'];
  onSettings: (id: string) => void;
  onConnections: (id: string) => void;
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
  if (!nodes.length) return null;
  const node = nodes.length === 1 ? nodes[0] : null;
  const media = node?.data.asset ?? node?.data.output;
  const ready = !node?.data.output || outputStatus(node.data.output) === 'ready';
  const insertable = ready && media && (
    (media.kind === 'video' && isPlayableVideoUrl(media.url)) ||
    (media.kind === 'audio' && isPlayableAudioUrl(media.url)) ||
    ((media.kind === 'image' || media.kind === 'logo') && isPlayableImageUrl(media.url ?? media.thumbUrl))
  );
  return <div className={styles.selectionActions} role="toolbar" aria-label={copy.selectionActions} data-canvas-selection-actions>
    <span className={styles.selectionTitle}>{node?.data.title ?? `${nodes.length} ${copy.blocks}`}</span>
    {node ? <>
      <button type="button" data-canvas-selection-settings onClick={() => onSettings(node.id)}><Settings2 size={16} />{copy.settings}</button>
      <button type="button" onClick={() => onConnections(node.id)}><Link2 size={16} />{copy.connections}</button>
    </> : null}
    <StudioMenu open={menuOpen} onOpenChange={handleMenuOpenChange} label={copy.selectionActions} className={styles.selectionMenuRoot} menuClassName={styles.selectionMenu} trigger={(triggerProps) => <button type="button" {...triggerProps}><MoreHorizontal size={16} />{copy.actions}</button>}>
      {node?.data.kind.startsWith('asset-') ? <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); node.data.onOpenAssetLibrary?.(node.id); }}><Replace size={16} />{copy.replaceMedia}</button> : null}
      {node && insertable ? <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); node.data.onSendOutputToTimeline?.(node.id); }}><Send size={16} />{copy.insertAtPlayhead}</button> : null}
      <button type="button" role="menuitem" onClick={() => void copySelection()}><Copy size={16} />{copy.copySelection}</button>
      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete(); }}><Trash2 size={16} />{copy.deleteSelection}</button>
    </StudioMenu>
    {copyFailed ? <span className={styles.copyFailure} role="alert">{copy.copyFailed}</span> : null}
  </div>;
}
