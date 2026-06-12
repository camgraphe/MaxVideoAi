'use client';

/* eslint-disable @next/next/no-img-element */

import { memo, type MouseEvent, type ReactNode } from 'react';
import type { NodeProps, NodeTypes } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Box, Clapperboard, FileText, ImageIcon, Music2, Play, Plus, Send, Sparkles, StickyNote, Video } from 'lucide-react';
import { inputHandles, NodeFrame } from './workspace-node-frame';
import { AudioPreview, VideoPreview } from './workspace-node-media-preview';
import styles from '../../_styles/canvas-nodes.module.css';
import type { WorkspaceEdgeKind, WorkspaceGraphNode, WorkspaceInputConnector, WorkspaceShotStatus } from '../../_lib/workspace-types';
import {
  localizeWorkspaceAssetSubtitle,
  localizeWorkspaceNodeGeneratedText,
} from '../../_lib/workspace-generated-copy';
import { isPlayableAudioUrl, isPlayableVideoUrl, outputStatus } from '../../_lib/workspace-media-availability';
import { edgeLabel, WORKSPACE_EDGE_COLORS } from '../../_lib/workspace-templates';
import { localizeStudioEdgeKindLabel } from '../../../_lib/studio-copy';

function nodeCopy(data: WorkspaceGraphNode['data']): NonNullable<WorkspaceGraphNode['data']['studioCanvasCopy']>['nodes'] | null {
  return data.studioCanvasCopy?.nodes ?? null;
}

function connectorLabel(
  handle: WorkspaceEdgeKind,
  connectors: WorkspaceInputConnector[],
  copy: ReturnType<typeof nodeCopy>
): string {
  return connectors.find((connector) => connector.kind === handle)?.label ??
    (copy ? localizeStudioEdgeKindLabel(handle, copy) : edgeLabel(handle));
}

function connectorRequired(handle: WorkspaceEdgeKind, connectors: WorkspaceInputConnector[]): boolean {
  return Boolean(connectors.find((connector) => connector.kind === handle)?.required);
}

function connectorCapacity(handle: WorkspaceEdgeKind, connectors: WorkspaceInputConnector[]): Pick<WorkspaceInputConnector, 'capacityLabel' | 'remainingCount'> {
  const connector = connectors.find((candidate) => candidate.kind === handle);
  return {
    capacityLabel: connector?.capacityLabel ?? null,
    remainingCount: connector?.remainingCount,
  };
}

function ShotInputDock({ data }: { data: WorkspaceGraphNode['data'] }) {
  const handles = inputHandles(data);
  const connectors = Array.isArray(data.inputConnectors) ? data.inputConnectors : [];
  const copy = nodeCopy(data);
  if (!handles.length) return null;
  return (
    <div className={styles.shotInputDock}>
      {handles.map((handle) => {
        const color = WORKSPACE_EDGE_COLORS[handle] ?? '#8b5cf6';
        const label = connectorLabel(handle, connectors, copy);
        const { capacityLabel, remainingCount } = connectorCapacity(handle, connectors);
        const isFull = remainingCount === 0;
        return (
          <div key={`shot-input-${handle}`} className={`${styles.shotInputRow} ${isFull ? styles.shotInputRowDisabled : ''}`}>
            <Handle
              id={handle}
              type="target"
              position={Position.Left}
              className={styles.graphHandle}
              style={{
                top: '50%',
                left: -12,
                borderColor: color,
                background: color,
                opacity: isFull ? 0.35 : 1,
              }}
              title={label}
            />
            <span className={styles.shotInputName}>
              {label}
              {connectorRequired(handle, connectors) ? ' *' : ''}
            </span>
            {capacityLabel ? <span className={styles.shotInputCapacity}>{capacityLabel}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function EmptyMediaPicker({
  data,
  icon,
  label,
  nodeId,
}: {
  data: WorkspaceGraphNode['data'];
  icon: ReactNode;
  label: string;
  nodeId: string;
}) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    data.onOpenAssetLibrary?.(nodeId);
  };
  return (
    <button type="button" className={`${styles.mediaPickerEmpty} nodrag`} onClick={handleClick} aria-label={label}>
      <span>{icon}</span>
      <strong>
        <Plus size={15} />
      </strong>
    </button>
  );
}

function MediaPreview({
  data,
  icon,
  label,
  nodeId,
}: {
  data: WorkspaceGraphNode['data'];
  icon: ReactNode;
  label: string;
  nodeId: string;
}) {
  const asset = data.asset;
  const thumbUrl = asset && typeof asset === 'object' && 'thumbUrl' in asset ? String(asset.thumbUrl ?? '') : '';
  if (thumbUrl) {
    return (
      <div className={styles.nodePreview}>
        <img src={thumbUrl} alt="" />
      </div>
    );
  }
  return <EmptyMediaPicker data={data} icon={icon} label={label} nodeId={nodeId} />;
}

function AssetMeta({ data }: { data: WorkspaceGraphNode['data'] }) {
  const asset = data.asset;
  if (!asset || typeof asset !== 'object') return null;
  const copy = nodeCopy(data);
  const assetSubtitle = localizeWorkspaceAssetSubtitle(String(asset.subtitle ?? ''), copy);
  return (
    <div className={styles.nodeMetaRow}>
      <span>{String(asset.filename ?? data.subtitle ?? copy?.assetFallback ?? 'Asset')}</span>
      <span>{assetSubtitle}</span>
    </div>
  );
}

export function AssetImageNode(props: NodeProps<WorkspaceGraphNode>) {
  const copy = nodeCopy(props.data);
  return (
    <NodeFrame nodeId={props.id} data={props.data} selected={props.selected} icon={<ImageIcon size={14} />} className={styles.assetNode}>
      <MediaPreview data={props.data} icon={<ImageIcon size={22} />} label={copy?.addImage ?? 'Add image'} nodeId={props.id} />
      <AssetMeta data={props.data} />
    </NodeFrame>
  );
}

export function AssetVideoNode(props: NodeProps<WorkspaceGraphNode>) {
  const copy = nodeCopy(props.data);
  const asset = props.data.asset;
  const thumbUrl = asset && typeof asset === 'object' && 'thumbUrl' in asset ? String(asset.thumbUrl ?? '') : '';
  const videoUrl = asset && typeof asset === 'object' && 'url' in asset ? String(asset.url ?? '') : '';
  const playableVideoUrl = isPlayableVideoUrl(videoUrl) ? videoUrl : null;
  return (
    <NodeFrame nodeId={props.id} data={props.data} selected={props.selected} icon={<Video size={14} />} className={styles.assetNode}>
      {playableVideoUrl ? (
        <VideoPreview videoUrl={playableVideoUrl} posterUrl={thumbUrl || null} />
      ) : (
        <MediaPreview data={props.data} icon={<Video size={22} />} label={copy?.addVideo ?? 'Add video'} nodeId={props.id} />
      )}
      {thumbUrl && !playableVideoUrl ? (
        <div className={styles.previewPlayBadge}>
          <Play size={14} />
        </div>
      ) : null}
      <AssetMeta data={props.data} />
    </NodeFrame>
  );
}

export function AssetAudioNode(props: NodeProps<WorkspaceGraphNode>) {
  const copy = nodeCopy(props.data);
  const asset = props.data.asset;
  const audioUrl = asset && typeof asset === 'object' && 'url' in asset ? String(asset.url ?? '') : '';
  const playableAudioUrl = isPlayableAudioUrl(audioUrl) ? audioUrl : null;
  const bars = [36, 58, 42, 76, 50, 64, 32, 82, 45, 68, 40, 54, 72, 35, 62, 48, 70, 44, 60, 38];
  return (
    <NodeFrame nodeId={props.id} data={props.data} selected={props.selected} icon={<Music2 size={14} />} className={styles.audioNode}>
      {playableAudioUrl ? (
        <AudioPreview audioUrl={playableAudioUrl} />
      ) : props.data.asset ? (
        <div className={styles.waveform} aria-hidden="true">
          {bars.map((height, index) => (
            <span key={`${height}-${index}`} style={{ height: `${height}%` }} />
          ))}
        </div>
      ) : (
        <EmptyMediaPicker data={props.data} icon={<Music2 size={22} />} label={copy?.addAudio ?? 'Add audio'} nodeId={props.id} />
      )}
      <AssetMeta data={props.data} />
    </NodeFrame>
  );
}

export function TextPromptNode(props: NodeProps<WorkspaceGraphNode>) {
  const copy = nodeCopy(props.data);
  const value = typeof props.data.promptText === 'string'
    ? copy
      ? localizeWorkspaceNodeGeneratedText(props.data.promptText, props.data.generatedCopy?.promptText, copy) ?? props.data.promptText
      : props.data.promptText
    : '';
  return (
    <NodeFrame nodeId={props.id} data={props.data} selected={props.selected} icon={<FileText size={14} />} className={styles.promptNode}>
      <textarea
        className={`${styles.promptTextarea} nodrag`}
        value={value}
        onChange={(event) => props.data.onPromptChange?.(props.id, event.currentTarget.value)}
        rows={4}
        spellCheck={false}
      />
      <div className={styles.nodeMetaRow}>
        <span>{typeof props.data.promptRole === 'string' ? (
          copy ? localizeStudioEdgeKindLabel(props.data.promptRole as WorkspaceEdgeKind, copy) : edgeLabel(props.data.promptRole as WorkspaceEdgeKind)
        ) : copy?.promptFallback ?? 'Prompt'}</span>
        <span>{value.length} {copy?.chars ?? 'chars'}</span>
      </div>
    </NodeFrame>
  );
}

export function NoteNode(props: NodeProps<WorkspaceGraphNode>) {
  const value = typeof props.data.promptText === 'string' ? props.data.promptText : '';
  const copy = nodeCopy(props.data);
  return (
    <NodeFrame nodeId={props.id} data={props.data} selected={props.selected} icon={<StickyNote size={14} />} className={styles.noteNode}>
      <textarea
        className={`${styles.promptTextarea} ${styles.noteTextarea} nodrag`}
        value={value}
        onChange={(event) => props.data.onPromptChange?.(props.id, event.currentTarget.value)}
        rows={5}
        spellCheck={false}
      />
      <div className={styles.nodeMetaRow}>
        <span>{copy?.canvasNote ?? 'Canvas note'}</span>
        <span>{value.length} {copy?.chars ?? 'chars'}</span>
      </div>
    </NodeFrame>
  );
}

function statusLabel(status: WorkspaceShotStatus, copy: ReturnType<typeof nodeCopy>): string {
  if (status === 'generating') return copy?.generating ?? 'Generating';
  if (status === 'completed') return copy?.completed ?? 'Completed';
  if (status === 'failed') return copy?.failed ?? 'Failed';
  if (status === 'incompatible') return copy?.incompatible ?? 'Incompatible';
  if (status === 'ready') return copy?.ready ?? 'Ready';
  return copy?.draft ?? 'Draft';
}

export function ShotNode(props: NodeProps<WorkspaceGraphNode>) {
  const copy = nodeCopy(props.data);
  const shot = props.data.shot;
  const status = shot?.status ?? 'draft';
  const validation = props.data.validation;
  const canGenerate = validation?.canGenerate ?? status !== 'incompatible';
  const estimatedCost = props.data.pricingEstimate?.label ?? 'Estimating...';
  return (
    <NodeFrame nodeId={props.id} data={props.data} selected={props.selected} icon={<Clapperboard size={14} />} className={styles.shotNode}>
      <div className={styles.shotDropZone}>
        <Box size={22} />
        <span>{status === 'completed' ? copy?.outputAvailable ?? 'Output available' : copy?.clickToGenerate ?? 'Click to generate'}</span>
      </div>
      <div className={styles.shotNodeFooter}>
        <span>{shot?.durationSec ?? 5}s</span>
        <span>{shot?.aspectRatio ?? '16:9'}</span>
        <span className={styles.modelBadge}>{validation?.capability?.label ?? shot?.modelId ?? copy?.modelFallback ?? 'Model'}</span>
      </div>
      <div className={styles.shotCostLine}>
        <span>{estimatedCost}</span>
      </div>
      <button
        type="button"
        className={`${styles.nodeActionButton} nodrag`}
        disabled={!canGenerate || status === 'generating'}
        onClick={() => props.data.onGenerateShot?.(props.id)}
      >
        <Sparkles size={13} />
        {status === 'generating' ? copy?.generating ?? 'Generating' : copy?.generate ?? 'Generate'}
      </button>
      <p className={`${styles.statusPill} ${styles[`status-${status}`]}`}>{statusLabel(status, copy)}</p>
      <ShotInputDock data={props.data} />
    </NodeFrame>
  );
}

export function OutputNode(props: NodeProps<WorkspaceGraphNode>) {
  const copy = nodeCopy(props.data);
  const output = props.data.output;
  const thumbUrl = output?.thumbUrl ?? output?.url ?? null;
  const status = outputStatus(output);
  const playableVideoUrl = output?.kind === 'video' && isPlayableVideoUrl(output.url) ? output.url : null;
  const playableAudioUrl = output?.kind === 'audio' && isPlayableAudioUrl(output.url) ? output.url : null;
  const canSendToTimeline = status === 'ready' && Boolean(output?.url);
  return (
    <NodeFrame nodeId={props.id} data={props.data} selected={props.selected} icon={<Play size={14} />} className={styles.outputNode}>
      {playableVideoUrl ? (
        <VideoPreview videoUrl={playableVideoUrl} posterUrl={output?.thumbUrl ?? null} />
      ) : playableAudioUrl ? (
        <AudioPreview audioUrl={playableAudioUrl} />
      ) : thumbUrl ? (
        <div className={styles.nodePreview}>
          <img src={thumbUrl} alt="" />
          <span className={styles.previewPlayBadge}>
            <Play size={14} />
          </span>
        </div>
      ) : (
        <div className={`${styles.nodePreviewEmpty} ${status === 'processing' ? styles.processingPreview : ''}`}>
          {status === 'processing' ? <Sparkles size={22} /> : <Play size={22} />}
          <span>{status === 'processing' ? copy?.processing ?? 'Processing' : copy?.placeholder ?? 'Placeholder'}</span>
        </div>
      )}
      <div className={styles.nodeMetaRow}>
        <span>{output?.modelLabel ?? copy?.generatedOutput ?? 'Generated output'}</span>
        <span>{status === 'ready' && output?.durationSec ? `${output.durationSec}s` : status}</span>
      </div>
      <button
        type="button"
        className={`${styles.nodeActionButton} nodrag`}
        disabled={!canSendToTimeline}
        onClick={() => props.data.onSendOutputToTimeline?.(props.id)}
      >
        <Send size={13} />
        {copy?.sendToTimeline ?? 'Send to timeline'}
      </button>
    </NodeFrame>
  );
}

export const workspaceNodeTypes: NodeTypes = {
  'asset-image': memo(AssetImageNode),
  'asset-video': memo(AssetVideoNode),
  'asset-audio': memo(AssetAudioNode),
  'text-prompt': memo(TextPromptNode),
  note: memo(NoteNode),
  shot: memo(ShotNode),
  output: memo(OutputNode),
};
