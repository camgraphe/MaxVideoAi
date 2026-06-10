'use client';

/* eslint-disable @next/next/no-img-element */

import { memo, type MouseEvent, type ReactNode } from 'react';
import type { NodeProps, NodeTypes } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Box, Clapperboard, FileText, ImageIcon, Music2, Play, Plus, Send, Sparkles, Video } from 'lucide-react';
import { inputHandles, NodeFrame } from './workspace-node-frame';
import { AudioPreview, VideoPreview } from './workspace-node-media-preview';
import styles from '../../_styles/canvas-nodes.module.css';
import type { WorkspaceEdgeKind, WorkspaceGraphNode, WorkspaceInputConnector, WorkspaceShotStatus } from '../../_lib/workspace-types';
import { isPlayableAudioUrl, isPlayableVideoUrl, outputStatus } from '../../_lib/workspace-media-availability';
import { edgeLabel, WORKSPACE_EDGE_COLORS } from '../../_lib/workspace-templates';

function connectorLabel(handle: WorkspaceEdgeKind, connectors: WorkspaceInputConnector[]): string {
  return connectors.find((connector) => connector.kind === handle)?.label ?? edgeLabel(handle);
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
  if (!handles.length) return null;
  return (
    <div className={styles.shotInputDock}>
      {handles.map((handle) => {
        const color = WORKSPACE_EDGE_COLORS[handle] ?? '#8b5cf6';
        const label = connectorLabel(handle, connectors);
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
  return (
    <div className={styles.nodeMetaRow}>
      <span>{String(asset.filename ?? data.subtitle ?? 'Asset')}</span>
      <span>{String(asset.subtitle ?? '')}</span>
    </div>
  );
}

export function AssetImageNode(props: NodeProps<WorkspaceGraphNode>) {
  return (
    <NodeFrame nodeId={props.id} data={props.data} selected={props.selected} icon={<ImageIcon size={14} />} className={styles.assetNode}>
      <MediaPreview data={props.data} icon={<ImageIcon size={22} />} label="Add image" nodeId={props.id} />
      <AssetMeta data={props.data} />
    </NodeFrame>
  );
}

export function AssetVideoNode(props: NodeProps<WorkspaceGraphNode>) {
  const asset = props.data.asset;
  const thumbUrl = asset && typeof asset === 'object' && 'thumbUrl' in asset ? String(asset.thumbUrl ?? '') : '';
  const videoUrl = asset && typeof asset === 'object' && 'url' in asset ? String(asset.url ?? '') : '';
  const playableVideoUrl = isPlayableVideoUrl(videoUrl) ? videoUrl : null;
  return (
    <NodeFrame nodeId={props.id} data={props.data} selected={props.selected} icon={<Video size={14} />} className={styles.assetNode}>
      {playableVideoUrl ? (
        <VideoPreview videoUrl={playableVideoUrl} posterUrl={thumbUrl || null} />
      ) : (
        <MediaPreview data={props.data} icon={<Video size={22} />} label="Add video" nodeId={props.id} />
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
        <EmptyMediaPicker data={props.data} icon={<Music2 size={22} />} label="Add audio" nodeId={props.id} />
      )}
      <AssetMeta data={props.data} />
    </NodeFrame>
  );
}

export function TextPromptNode(props: NodeProps<WorkspaceGraphNode>) {
  const value = typeof props.data.promptText === 'string' ? props.data.promptText : '';
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
        <span>{typeof props.data.promptRole === 'string' ? edgeLabel(props.data.promptRole as WorkspaceEdgeKind) : 'Prompt'}</span>
        <span>{value.length} chars</span>
      </div>
    </NodeFrame>
  );
}

function statusLabel(status: WorkspaceShotStatus): string {
  if (status === 'generating') return 'Generating';
  if (status === 'completed') return 'Completed';
  if (status === 'failed') return 'Failed';
  if (status === 'incompatible') return 'Incompatible';
  if (status === 'ready') return 'Ready';
  return 'Draft';
}

export function ShotNode(props: NodeProps<WorkspaceGraphNode>) {
  const shot = props.data.shot;
  const status = shot?.status ?? 'draft';
  const validation = props.data.validation;
  const canGenerate = validation?.canGenerate ?? status !== 'incompatible';
  const estimatedCost = props.data.pricingEstimate?.label ?? 'Estimating...';
  return (
    <NodeFrame nodeId={props.id} data={props.data} selected={props.selected} icon={<Clapperboard size={14} />} className={styles.shotNode}>
      <div className={styles.shotDropZone}>
        <Box size={22} />
        <span>{status === 'completed' ? 'Output available' : 'Click to generate'}</span>
      </div>
      <div className={styles.shotNodeFooter}>
        <span>{shot?.durationSec ?? 5}s</span>
        <span>{shot?.aspectRatio ?? '16:9'}</span>
        <span className={styles.modelBadge}>{validation?.capability?.label ?? shot?.modelId ?? 'Model'}</span>
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
        {status === 'generating' ? 'Generating' : 'Generate'}
      </button>
      <p className={`${styles.statusPill} ${styles[`status-${status}`]}`}>{statusLabel(status)}</p>
      <ShotInputDock data={props.data} />
    </NodeFrame>
  );
}

export function OutputNode(props: NodeProps<WorkspaceGraphNode>) {
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
          <span>{status === 'processing' ? 'Processing' : 'Placeholder'}</span>
        </div>
      )}
      <div className={styles.nodeMetaRow}>
        <span>{output?.modelLabel ?? 'Generated output'}</span>
        <span>{status === 'ready' && output?.durationSec ? `${output.durationSec}s` : status}</span>
      </div>
      <button
        type="button"
        className={`${styles.nodeActionButton} nodrag`}
        disabled={!canSendToTimeline}
        onClick={() => props.data.onSendOutputToTimeline?.(props.id)}
      >
        <Send size={13} />
        Send to timeline
      </button>
    </NodeFrame>
  );
}

export const workspaceNodeTypes: NodeTypes = {
  'asset-image': memo(AssetImageNode),
  'asset-video': memo(AssetVideoNode),
  'asset-audio': memo(AssetAudioNode),
  'text-prompt': memo(TextPromptNode),
  shot: memo(ShotNode),
  output: memo(OutputNode),
};
