'use client';

import { ViewportPortal, type XYPosition } from '@xyflow/react';
import type { CSSProperties } from 'react';

import styles from '../../maxvideoai-editor.module.css';
import type { WorkspaceEdgeKind } from '../../_lib/workspace-types';
import type {
  WorkspaceHandleDropDirection,
  WorkspaceHandleDropDraft,
} from '../../_lib/workspace-handle-drop';

export type HandleDropPreview = {
  sourceNodeId: string;
  handleId: WorkspaceEdgeKind;
  handleType: WorkspaceHandleDropDirection;
  draft: WorkspaceHandleDropDraft;
  origin: XYPosition;
  position: XYPosition;
};

export function CanvasHandleDropPreview({ preview }: { preview: HandleDropPreview }) {
  const x1 = preview.origin.x;
  const y1 = preview.origin.y;
  const x2 = preview.position.x;
  const y2 = preview.position.y;
  const controlOffset = Math.max(48, Math.min(180, Math.abs(x2 - x1) * 0.45));
  const path = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
  const ghostStyle = {
    '--node-accent': preview.draft.accent,
    transform: `translate(${x2 + 20}px, ${y2 - 44}px)`,
  } as CSSProperties;
  const linkStyle = {
    '--node-accent': preview.draft.accent,
  } as CSSProperties;

  return (
    <ViewportPortal>
      <svg className={styles.workspaceGhostLink} style={linkStyle} aria-hidden="true">
        <path d={path} stroke={preview.draft.accent} />
      </svg>
      <div className={styles.workspaceGhostNode} style={ghostStyle} aria-hidden="true">
        <strong>{preview.draft.title}</strong>
        <span>{preview.draft.subtitle}</span>
      </div>
    </ViewportPortal>
  );
}
