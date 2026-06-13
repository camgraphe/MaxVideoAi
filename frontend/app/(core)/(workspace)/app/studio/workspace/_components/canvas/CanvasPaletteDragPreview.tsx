'use client';

import { ViewportPortal, type XYPosition } from '@xyflow/react';
import type { CSSProperties } from 'react';

import styles from '../../_styles/canvas.module.css';
import { getWorkspaceBlockPreset } from '../../_lib/workspace-block-presets';
import type { WorkspaceGenerationPresetId, WorkspaceNodeKind } from '../../_lib/workspace-types';
import type { StudioCopy } from '../../../_lib/studio-copy';

export const WORKSPACE_NODE_KIND_DRAG_TYPE = 'application/x-maxvideoai-node-kind';
export const PALETTE_DRAG_START_EVENT = 'maxvideoai:palette-drag-start';

const WORKSPACE_NODE_KINDS: readonly WorkspaceNodeKind[] = [
  'asset-image',
  'asset-video',
  'asset-audio',
  'text-prompt',
  'note',
  'shot',
  'chat',
  'output',
];

export type PaletteDragPreview = {
  kind: WorkspaceNodeKind;
  presetId?: WorkspaceGenerationPresetId;
  title: string;
  subtitle: string;
  accent: string;
  position: XYPosition;
};

export type PaletteDragStartDetail = {
  kind: WorkspaceNodeKind;
  presetId?: WorkspaceGenerationPresetId;
  clientX: number;
  clientY: number;
};

export function isWorkspaceNodeKind(value: string): value is WorkspaceNodeKind {
  return WORKSPACE_NODE_KINDS.includes(value as WorkspaceNodeKind);
}

export function palettePreviewForKind(
  kind: WorkspaceNodeKind,
  position: XYPosition,
  copy: StudioCopy['canvas']['nodes'],
  presetId?: WorkspaceGenerationPresetId
): PaletteDragPreview {
  const preset = getWorkspaceBlockPreset(presetId);
  if (preset) {
    return {
      kind,
      presetId: preset.id,
      title: copy[preset.titleKey] ?? copy[preset.labelKey] ?? preset.id,
      subtitle: copy[preset.subtitleKey] ?? copy[preset.descriptionKey] ?? '',
      accent: preset.accent,
      position,
    };
  }
  if (kind === 'asset-image') return { kind, title: copy.imageReference, subtitle: copy.emptyMediaBlock, accent: '#8b5cf6', position };
  if (kind === 'asset-video') return { kind, title: copy.videoReference, subtitle: copy.emptyMediaBlock, accent: '#2563eb', position };
  if (kind === 'asset-audio') return { kind, title: copy.audioReference, subtitle: copy.emptyMediaBlock, accent: '#22c55e', position };
  if (kind === 'text-prompt') return { kind, title: copy.promptBlock, subtitle: copy.textSource, accent: '#60a5fa', position };
  if (kind === 'note') return { kind, title: copy.freeTextNote, subtitle: copy.canvasNote, accent: '#facc15', position };
  if (kind === 'output') return { kind, title: copy.outputBlock, subtitle: copy.generatedResult, accent: '#f97316', position };
  return { kind, title: copy.generateBlock, subtitle: copy.unifiedVideoModel, accent: '#f97316', position };
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
