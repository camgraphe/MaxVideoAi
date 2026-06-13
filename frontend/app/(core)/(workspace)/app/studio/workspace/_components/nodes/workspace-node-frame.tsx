'use client';

import { useRef, type CSSProperties, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Handle, NodeResizeControl, Position } from '@xyflow/react';
import { Settings2 } from 'lucide-react';
import styles from '../../_styles/canvas-nodes.module.css';
import {
  clearTimelineNodeDragPayload,
  rememberTimelineNodeDragPayload,
  TIMELINE_NODE_DRAG_TYPE,
} from '../../_lib/timeline/timeline-external-drop';
import type { WorkspaceEdgeKind, WorkspaceGraphNode, WorkspaceNodeKind } from '../../_lib/workspace-types';
import {
  isPlayableAudioUrl,
  isPlayableImageUrl,
  isPlayableVideoUrl,
  outputStatus,
} from '../../_lib/workspace-media-availability';
import {
  workspaceAssetHasTimelineAudio,
  workspaceAssetTimelineDuration,
  workspaceOutputHasTimelineAudio,
  workspaceOutputTimelineDuration,
} from '../../_lib/workspace-timeline-editing';
import { WORKSPACE_EDGE_COLORS } from '../../_lib/workspace-templates';
import {
  DEFAULT_STUDIO_COPY,
  localizeStudioEdgeKindLabel,
} from '../../../_lib/studio-copy';

const SOURCE_NODE_MIN_WIDTH = 190;
const SOURCE_NODE_MIN_HEIGHT = 132;
const OUTPUT_NODE_MIN_HEIGHT = 190;
const SOURCE_NODE_MAX_WIDTH = 460;
const SOURCE_NODE_MAX_HEIGHT = 380;
const SOURCE_RESIZABLE_NODE_KINDS = new Set<WorkspaceNodeKind>(['asset-image', 'asset-video', 'asset-audio', 'text-prompt', 'note', 'chat', 'output']);

function nodeAccent(data: WorkspaceGraphNode['data']): string {
  return typeof data.accent === 'string' ? data.accent : '#8b5cf6';
}

function isSourceResizableNodeKind(kind: WorkspaceNodeKind): boolean {
  return SOURCE_RESIZABLE_NODE_KINDS.has(kind);
}

function sourceNodeMinHeight(kind: WorkspaceNodeKind): number {
  return kind === 'output' ? OUTPUT_NODE_MIN_HEIGHT : SOURCE_NODE_MIN_HEIGHT;
}

function outputHandles(data: WorkspaceGraphNode['data']): WorkspaceEdgeKind[] {
  return Array.isArray(data.sourceHandles) ? (data.sourceHandles as WorkspaceEdgeKind[]) : [];
}

export function inputHandles(data: WorkspaceGraphNode['data']): WorkspaceEdgeKind[] {
  return Array.isArray(data.targetHandles) ? (data.targetHandles as WorkspaceEdgeKind[]) : [];
}

function timelineDragMediaKind(data: WorkspaceGraphNode['data']): 'audio' | 'image' | 'video' | null {
  if (data.asset) {
    const assetUrl = data.asset.url ?? data.asset.thumbUrl ?? null;
    if (data.asset.kind === 'video' && isPlayableVideoUrl(data.asset.url)) return 'video';
    if (data.asset.kind === 'audio' && isPlayableAudioUrl(data.asset.url)) return 'audio';
    if ((data.asset.kind === 'image' || data.asset.kind === 'logo') && isPlayableImageUrl(assetUrl)) return 'image';
  }
  if (data.output && outputStatus(data.output) === 'ready') {
    const outputUrl = data.output.url ?? data.output.thumbUrl ?? null;
    if (data.output.kind === 'video' && isPlayableVideoUrl(data.output.url)) return 'video';
    if (data.output.kind === 'audio' && isPlayableAudioUrl(data.output.url)) return 'audio';
    if (data.output.kind === 'image' && isPlayableImageUrl(outputUrl)) return 'image';
  }
  return null;
}

function timelineDragDuration(data: WorkspaceGraphNode['data']): number | null {
  if (data.asset) return workspaceAssetTimelineDuration(data.asset);
  if (data.output && outputStatus(data.output) === 'ready') return workspaceOutputTimelineDuration(data.output);
  return null;
}

function timelineDragPreviewUrl(data: WorkspaceGraphNode['data']): string | null {
  if (data.asset) return data.asset.thumbUrl ?? data.asset.url ?? null;
  if (data.output) return data.output.thumbUrl ?? data.output.url ?? null;
  return null;
}

function timelineDragHasAudio(data: WorkspaceGraphNode['data']): boolean {
  if (data.asset) return workspaceAssetHasTimelineAudio(data.asset);
  if (data.output && outputStatus(data.output) === 'ready') return workspaceOutputHasTimelineAudio(data.output);
  return false;
}

function blocksTimelineNodeDrag(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        '.react-flow__handle',
        '.nodrag',
        '.nowheel',
        'button',
        'input',
        'textarea',
        'select',
        'audio',
        'video',
        '[contenteditable="true"]',
      ].join(', ')
    )
  );
}

function HandleStack({
  copy,
  handles,
  type,
}: {
  copy?: NonNullable<WorkspaceGraphNode['data']['studioCanvasCopy']>['nodes'];
  handles: WorkspaceEdgeKind[];
  type: 'source' | 'target';
}) {
  const spacing = handles.length > 8 ? 14 : 22;
  return (
    <>
      {handles.map((handle, index) => {
        const offset = 34 + index * spacing;
        const color = WORKSPACE_EDGE_COLORS[handle] ?? '#8b5cf6';
        const labelCopy = copy ?? DEFAULT_STUDIO_COPY.canvas.nodes;
        return (
          <Handle
            key={`${type}-${handle}`}
            id={handle}
            type={type}
            position={type === 'source' ? Position.Right : Position.Left}
            className={styles.graphHandle}
            style={{
              top: offset,
              borderColor: color,
              background: color,
            }}
            title={localizeStudioEdgeKindLabel(handle, labelCopy)}
          />
        );
      })}
    </>
  );
}

export function NodeFrame({
  nodeId,
  data,
  selected,
  children,
  icon,
  className = '',
}: {
  nodeId: string;
  data: WorkspaceGraphNode['data'];
  selected: boolean;
  children: ReactNode;
  icon: ReactNode;
  className?: string;
}) {
  const accent = nodeAccent(data);
  const targetHandles = data.kind === 'shot' ? [] : inputHandles(data);
  const isResizable = isSourceResizableNodeKind(data.kind);
  const timelineMediaKind = timelineDragMediaKind(data);
  const copy = data.studioCanvasCopy?.nodes;
  const suppressTimelineDragRef = useRef(false);
  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    suppressTimelineDragRef.current = blocksTimelineNodeDrag(event.target);
  };
  const handleDragStart = (event: DragEvent<HTMLElement>) => {
    const shouldSuppressTimelineDrag = suppressTimelineDragRef.current || blocksTimelineNodeDrag(event.target);
    suppressTimelineDragRef.current = false;
    if (shouldSuppressTimelineDrag) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!timelineMediaKind) {
      event.preventDefault();
      return;
    }
    const payload = {
      durationSec: timelineDragDuration(data),
      hasTimelineAudio: timelineDragHasAudio(data),
      nodeId,
      mediaKind: timelineMediaKind,
      previewUrl: timelineDragPreviewUrl(data),
      title: data.title,
    };
    rememberTimelineNodeDragPayload(payload);
    event.dataTransfer.effectAllowed = 'copyMove';
    event.dataTransfer.setData(TIMELINE_NODE_DRAG_TYPE, JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', data.title);
  };
  return (
    <article
      className={`${styles.graphNode} ${isResizable ? styles.sourceResizableNode : ''} ${timelineMediaKind ? styles.graphNodeTimelineDraggable : ''} ${selected ? styles.graphNodeSelected : ''} ${className}`}
      data-timeline-node-drag-kind={timelineMediaKind ?? undefined}
      draggable={Boolean(timelineMediaKind)}
      onPointerDown={handlePointerDown}
      onDragEnd={clearTimelineNodeDragPayload}
      onDragStart={handleDragStart}
      style={{ '--node-accent': accent } as CSSProperties}
    >
      {isResizable ? (
        <NodeResizeControl
          nodeId={nodeId}
          position="bottom-left"
          className={`${styles.nodeResizeControl} nodrag nowheel`}
          minWidth={SOURCE_NODE_MIN_WIDTH}
          minHeight={sourceNodeMinHeight(data.kind)}
          maxWidth={SOURCE_NODE_MAX_WIDTH}
          maxHeight={SOURCE_NODE_MAX_HEIGHT}
        >
          <span className={styles.nodeResizeGrip} aria-hidden="true" />
        </NodeResizeControl>
      ) : null}
      <HandleStack copy={copy} handles={targetHandles} type="target" />
      <div className={styles.nodeHeader}>
        <span className={styles.nodeIcon}>{icon}</span>
        <div>
          <p className={styles.nodeTitle}>{data.title}</p>
          {data.subtitle ? <p className={styles.nodeSubtitle}>{data.subtitle}</p> : null}
        </div>
        {selected ? (
          <button
            type="button"
            className={`${styles.nodeInspectButton} nodrag nowheel`}
            data-canvas-node-inspect-button={nodeId}
            aria-label={(copy?.openSettings ?? 'Open {name} settings').replace('{name}', data.title)}
            title={copy?.openSettingsTitle ?? 'Open settings (I)'}
          >
            <Settings2 size={13} strokeWidth={2.2} />
          </button>
        ) : null}
      </div>
      {children}
      <HandleStack copy={copy} handles={outputHandles(data)} type="source" />
    </article>
  );
}
