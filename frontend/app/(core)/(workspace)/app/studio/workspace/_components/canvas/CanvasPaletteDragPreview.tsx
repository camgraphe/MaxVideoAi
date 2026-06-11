'use client';

import { ViewportPortal, type XYPosition } from '@xyflow/react';
import type { CSSProperties } from 'react';

import styles from '../../_styles/canvas.module.css';
import type { WorkspaceNodeKind } from '../../_lib/workspace-types';

export const WORKSPACE_NODE_KIND_DRAG_TYPE = 'application/x-maxvideoai-node-kind';
export const PALETTE_DRAG_START_EVENT = 'maxvideoai:palette-drag-start';

const WORKSPACE_NODE_KINDS: readonly WorkspaceNodeKind[] = [
  'asset-image',
  'asset-video',
  'asset-audio',
  'text-prompt',
  'note',
  'shot',
  'output',
];

export type PaletteDragPreview = {
  kind: WorkspaceNodeKind;
  title: string;
  subtitle: string;
  accent: string;
  position: XYPosition;
};

export type PaletteDragStartDetail = {
  kind: WorkspaceNodeKind;
  clientX: number;
  clientY: number;
};

export function isWorkspaceNodeKind(value: string): value is WorkspaceNodeKind {
  return WORKSPACE_NODE_KINDS.includes(value as WorkspaceNodeKind);
}

export function palettePreviewForKind(kind: WorkspaceNodeKind, position: XYPosition): PaletteDragPreview {
  if (kind === 'asset-image') return { kind, title: 'Image reference', subtitle: 'Empty media block', accent: '#8b5cf6', position };
  if (kind === 'asset-video') return { kind, title: 'Video reference', subtitle: 'Empty media block', accent: '#2563eb', position };
  if (kind === 'asset-audio') return { kind, title: 'Audio reference', subtitle: 'Empty media block', accent: '#22c55e', position };
  if (kind === 'text-prompt') return { kind, title: 'Prompt block', subtitle: 'Text source', accent: '#60a5fa', position };
  if (kind === 'note') return { kind, title: 'Free text note', subtitle: 'Canvas note', accent: '#facc15', position };
  if (kind === 'output') return { kind, title: 'Output block', subtitle: 'Generated result', accent: '#f97316', position };
  return { kind, title: 'Generate block', subtitle: 'Unified video model', accent: '#f97316', position };
}

export function CanvasPaletteDragPreview({ preview }: { preview: PaletteDragPreview }) {
  const ghostStyle = {
    '--node-accent': preview.accent,
    transform: `translate(${preview.position.x + 20}px, ${preview.position.y - 44}px)`,
  } as CSSProperties;

  return (
    <ViewportPortal>
      <div className={styles.workspaceGhostNode} style={ghostStyle} aria-hidden="true">
        <strong>{preview.title}</strong>
        <span>{preview.subtitle}</span>
      </div>
    </ViewportPortal>
  );
}
