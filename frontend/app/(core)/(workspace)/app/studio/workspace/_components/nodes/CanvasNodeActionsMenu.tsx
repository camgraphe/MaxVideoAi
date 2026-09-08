'use client';

import { Copy, Link2, MoreHorizontal, Replace, Send, Trash2 } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import styles from '../../_styles/canvas-node-actions.module.css';
import type { WorkspaceGraphNode } from '../../_lib/workspace-types';
import {
  isPlayableAudioUrl,
  isPlayableImageUrl,
  isPlayableVideoUrl,
  outputStatus,
} from '../../_lib/workspace-media-availability';
import { StudioMenu } from '../ui/StudioMenu';
import { useCanvasNodeActions } from '../canvas/CanvasNodeActionsContext';

const CANVAS_INSET = 8;
const CANVAS_COMMAND_GAP = 6;
const CANVAS_COMMAND_OBSTACLES = [
  '[data-canvas-floating-toolbar="true"]',
  '[data-canvas-navigator="true"]',
  '[data-studio-mobile-panel-controls="true"]',
].join(',');

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

function overlapArea(
  candidate: { left: number; top: number; right: number; bottom: number },
  obstacle: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>,
): number {
  return Math.max(0, Math.min(candidate.right, obstacle.right) - Math.max(candidate.left, obstacle.left))
    * Math.max(0, Math.min(candidate.bottom, obstacle.bottom) - Math.max(candidate.top, obstacle.top));
}

/** Keep the compact card commands in screen pixels while their node pans and zooms. */
export function CanvasNodeActionsPortal({ children, accent }: { children: ReactNode; accent: string }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setCanvas(anchorRef.current?.closest<HTMLElement>('.react-flow') ?? null);
  }, []);

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const node = anchorRef.current?.closest('article');
    if (!canvas || !overlay || !node) return;
    let frame = 0;
    const position = () => {
      const bounds = canvas.getBoundingClientRect();
      const nodeBounds = node.getBoundingClientRect();
      const controls = overlay.getBoundingClientRect();
      const clampX = (x: number) => clamp(x, CANVAS_INSET, bounds.width - controls.width - CANVAS_INSET);
      const clampY = (y: number) => clamp(y, CANVAS_INSET, bounds.height - controls.height - CANVAS_INSET);
      const rightAligned = nodeBounds.right - bounds.left - controls.width;
      const candidates = [
        { x: rightAligned, y: nodeBounds.top - bounds.top - controls.height - CANVAS_COMMAND_GAP },
        { x: rightAligned, y: nodeBounds.bottom - bounds.top + CANVAS_COMMAND_GAP },
        { x: nodeBounds.right - bounds.left + CANVAS_COMMAND_GAP, y: nodeBounds.top - bounds.top },
        { x: nodeBounds.left - bounds.left - controls.width - CANVAS_COMMAND_GAP, y: nodeBounds.top - bounds.top },
      ].map(({ x, y }) => ({ x: clampX(x), y: clampY(y) }));
      const obstacleScope = canvas.closest<HTMLElement>('[data-studio-canvas-shell]') ?? canvas.parentElement ?? canvas;
      const obstacles = [
        nodeBounds,
        ...Array.from(obstacleScope.querySelectorAll<HTMLElement>(CANVAS_COMMAND_OBSTACLES))
          .filter((element) => !overlay.contains(element))
          .map((element) => element.getBoundingClientRect()),
      ];
      const { x, y } = candidates.reduce((best, candidate) => {
        const candidateBounds = {
          left: bounds.left + candidate.x,
          top: bounds.top + candidate.y,
          right: bounds.left + candidate.x + controls.width,
          bottom: bounds.top + candidate.y + controls.height,
        };
        const score = obstacles.reduce((total, obstacle) => total + overlapArea(candidateBounds, obstacle), 0);
        return score < best.score ? { ...candidate, score } : best;
      }, { ...candidates[0], score: Number.POSITIVE_INFINITY });
      overlay.style.left = `${x}px`;
      overlay.style.top = `${y}px`;
      overlay.style.visibility = 'visible';

      const menu = overlay.querySelector<HTMLElement>('[role="menu"]');
      if (!menu) return;
      const root = menu.parentElement!.getBoundingClientRect();
      menu.style.maxWidth = `${Math.max(0, bounds.width - CANVAS_INSET * 2)}px`;
      menu.style.maxHeight = `${Math.max(0, bounds.height - CANVAS_INSET * 2)}px`;
      const menuBounds = menu.getBoundingClientRect();
      const left = clamp(root.right - menuBounds.width, bounds.left + CANVAS_INSET, bounds.right - menuBounds.width - CANVAS_INSET);
      const below = root.bottom + 7;
      const preferredTop = below + menuBounds.height <= bounds.bottom - CANVAS_INSET ? below : root.top - menuBounds.height - 7;
      const top = clamp(preferredTop, bounds.top + CANVAS_INSET, bounds.bottom - menuBounds.height - CANVAS_INSET);
      menu.style.left = `${left - root.left}px`;
      menu.style.top = `${top - root.top}px`;
      menu.style.right = 'auto';
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(position);
    };
    position();
    const mutations = new MutationObserver(schedule);
    for (const element of [node.closest('.react-flow__node'), node.closest('.react-flow__viewport')]) {
      if (element) mutations.observe(element, { attributes: true, attributeFilter: ['style'] });
    }
    mutations.observe(overlay, { childList: true, subtree: true });
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    resize?.observe(canvas);
    resize?.observe(node);
    resize?.observe(overlay);
    window.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      mutations.disconnect();
      resize?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [canvas]);

  return <>
    <span ref={anchorRef} />
    {canvas ? createPortal(
      <div ref={overlayRef} className={`${styles.nodeActionsOverlay} nodrag nowheel nopan`}
        data-canvas-node-actions-overlay="true" style={{ '--node-accent': accent } as CSSProperties}>
        {children}
      </div>, canvas,
    ) : null}
  </>;
}

function canInsertNodeMedia(data: WorkspaceGraphNode['data']): boolean {
  const media = data.asset ?? data.output;
  if (!media || (data.output && outputStatus(data.output) !== 'ready')) return false;
  if (media.kind === 'video') return isPlayableVideoUrl(media.url);
  if (media.kind === 'audio') return isPlayableAudioUrl(media.url);
  if (media.kind === 'image' || media.kind === 'logo') return isPlayableImageUrl(media.url ?? media.thumbUrl);
  return false;
}

export function CanvasNodeActionsMenu({ nodeId, data }: { nodeId: string; data: WorkspaceGraphNode['data'] }) {
  const actions = useCanvasNodeActions();
  const [open, setOpen] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyAttemptRef = useRef(0);
  const copy = data.studioCanvasCopy?.nodes;
  if (!actions?.isSingleSelection || !copy) return null;

  const close = () => setOpen(false);
  const copyNode = async () => {
    const attempt = copyAttemptRef.current + 1;
    copyAttemptRef.current = attempt;
    setCopyFailed(false);
    close();
    let copied = false;
    try {
      copied = await actions.onCopyNode(nodeId);
    } catch {
      copied = false;
    }
    if (copyAttemptRef.current === attempt) setCopyFailed(!copied);
  };

  return (
    <div className={`${styles.nodeActionShell} nodrag nowheel`}>
    <StudioMenu
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          copyAttemptRef.current += 1;
          setCopyFailed(false);
        }
        setOpen(nextOpen);
      }}
      label={copy.selectionActions}
      className={styles.nodeActionsRoot}
      menuClassName={styles.nodeActionsMenu}
      trigger={(triggerProps) => (
        <button
          type="button"
          {...triggerProps}
          className={styles.nodeActionsButton}
          data-canvas-node-actions-button={nodeId}
          aria-label={copy.actions}
          title={copy.actions}
        >
          <MoreHorizontal size={15} strokeWidth={2.3} />
        </button>
      )}
    >
      {data.kind.startsWith('asset-') ? (
        <button type="button" role="menuitem" onClick={() => { close(); data.onOpenAssetLibrary?.(nodeId); }}>
          <Replace size={15} />{copy.replaceMedia}
        </button>
      ) : null}
      {canInsertNodeMedia(data) ? (
        <button type="button" role="menuitem" onClick={() => { close(); data.onSendOutputToTimeline?.(nodeId); }}>
          <Send size={15} />{copy.insertAtPlayhead}
        </button>
      ) : null}
      <button type="button" role="menuitem" onClick={() => { close(); actions.onConnections(nodeId); }}>
        <Link2 size={15} />{copy.connections}
      </button>
      <button type="button" role="menuitem" onClick={() => void copyNode()}>
        <Copy size={15} />{copy.copySelection}
      </button>
      <button type="button" role="menuitem" onClick={() => { close(); actions.onDeleteNode(nodeId); }}>
        <Trash2 size={15} />{copy.deleteSelection}
      </button>
    </StudioMenu>
    {copyFailed ? <span className={styles.nodeActionFailure} role="alert">{copy.copyFailed}</span> : null}
    </div>
  );
}
