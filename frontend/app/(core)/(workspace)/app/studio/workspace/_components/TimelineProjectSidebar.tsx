'use client';

import { FolderOpen, Film, Layers3, Plus, Upload } from 'lucide-react';
import type { DragEvent as ReactDragEvent } from 'react';
import styles from '../maxvideoai-editor.module.css';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphNode,
  WorkspaceProjectSettings,
  WorkspaceTimelineItem,
} from '../_lib/workspace-types';

export type WorkspaceProjectSequenceSummary = {
  id: string;
  name: string;
  durationSec: number;
  clipCount: number;
  settings: WorkspaceProjectSettings;
  isActive: boolean;
};

type TimelineProjectSidebarProps = {
  nodes: WorkspaceGraphNode[];
  projectAssets: WorkspaceAssetRecord[];
  projectName: string;
  sequences: WorkspaceProjectSequenceSummary[];
  timelineItems: WorkspaceTimelineItem[];
  onImportMedia: () => void;
  onInsertGeneratedClip: (nodeId: string) => void;
  onInsertProjectAsset: (assetId: string) => void;
  onNewSequence: () => void;
  onSelectSequence: (sequenceId: string) => void;
};

const TIMELINE_NODE_DRAG_TYPE = 'application/x-maxvideoai-timeline-node';

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const totalSeconds = Math.ceil(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function generatedClipNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
  return nodes.filter((node) => node.data.kind === 'output' && Boolean(node.data.output));
}

function timelineMediaKindForProjectAsset(asset: WorkspaceAssetRecord): 'audio' | 'image' | 'video' | null {
  if (asset.kind === 'audio') return 'audio';
  if (asset.kind === 'video') return 'video';
  if (asset.kind === 'image' || asset.kind === 'logo') return 'image';
  return null;
}

function beginProjectAssetTimelineDrag(event: ReactDragEvent<HTMLElement>, asset: WorkspaceAssetRecord): void {
  const mediaKind = timelineMediaKindForProjectAsset(asset);
  if (!mediaKind) return;
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData(TIMELINE_NODE_DRAG_TYPE, JSON.stringify({
    assetId: asset.id,
    mediaKind,
  }));
}

function MediaRow({
  actionLabel,
  asset,
  title,
  subtitle,
  onAction,
}: {
  actionLabel?: string;
  asset?: WorkspaceAssetRecord;
  title: string;
  subtitle: string;
  onAction?: () => void;
}) {
  const dragMediaKind = asset ? timelineMediaKindForProjectAsset(asset) : null;
  return (
    <div
      className={styles.projectMediaRow}
      data-project-media-asset-id={asset?.id}
      data-project-media-drag-kind={dragMediaKind ?? undefined}
      draggable={Boolean(dragMediaKind)}
      onDragStart={asset ? (event) => beginProjectAssetTimelineDrag(event, asset) : undefined}
    >
      <div className={styles.projectMediaRowText}>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      {onAction ? (
        <button type="button" className={styles.projectMediaRowAction} onClick={onAction}>
          {actionLabel ?? 'Insert'}
        </button>
      ) : null}
    </div>
  );
}

export function TimelineProjectSidebar({
  nodes,
  projectAssets,
  projectName,
  sequences,
  timelineItems,
  onImportMedia,
  onInsertGeneratedClip,
  onInsertProjectAsset,
  onNewSequence,
  onSelectSequence,
}: TimelineProjectSidebarProps) {
  const generatedNodes = generatedClipNodes(nodes);

  return (
    <aside className={`${styles.librarySidebar} ${styles.timelineProjectSidebar}`} aria-label="Project media library">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelTitle}>Project media</p>
          <span className={styles.panelSubtitle}>Assets, sequences and generated clips</span>
        </div>
      </div>

      <button type="button" className={styles.projectMediaActionButton} onClick={onImportMedia}>
        <Upload size={15} />
        Import media
      </button>

      <section className={styles.projectMediaSection} aria-label="Sequences">
        <div className={styles.sectionHeading}>
          <span>Sequences</span>
          <button
            type="button"
            className={styles.projectMediaIconButton}
            data-project-sequence-create="true"
            onClick={onNewSequence}
            aria-label="New sequence"
          >
            <Plus size={13} />
          </button>
        </div>
        <div className={styles.projectSequenceList}>
          {sequences.map((sequence) => (
            <button
              key={sequence.id}
              type="button"
              className={`${styles.projectSequenceButton} ${sequence.isActive ? styles.projectSequenceActive : ''}`}
              data-project-sequence-id={sequence.id}
              onClick={() => onSelectSequence(sequence.id)}
              aria-pressed={sequence.isActive}
            >
              <Film size={15} />
              <span>
                <strong>{sequence.name}</strong>
                <small>
                  {projectName} · {formatDuration(sequence.durationSec)} · {sequence.clipCount} clip{sequence.clipCount === 1 ? '' : 's'} · {sequence.settings.aspectRatio}
                </small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.projectMediaSection} aria-label="Imports">
        <div className={styles.sectionHeading}>
          <span>Imports</span>
          <span>{projectAssets.length}</span>
        </div>
        <div className={styles.projectMediaList}>
          {projectAssets.length ? (
            projectAssets.slice(0, 10).map((asset) => (
              <MediaRow
                key={asset.id}
                asset={asset}
                title={asset.filename}
                subtitle={asset.subtitle}
                actionLabel="Insert"
                onAction={asset.kind === 'text' ? undefined : () => onInsertProjectAsset(asset.id)}
              />
            ))
          ) : (
            <p className={styles.projectMediaEmpty}>No imported media yet.</p>
          )}
        </div>
      </section>

      <section className={styles.projectMediaSection} aria-label="Generated clips">
        <div className={styles.sectionHeading}>
          <span>Generated clips</span>
          <span>{generatedNodes.length}</span>
        </div>
        <div className={styles.projectMediaList}>
          {generatedNodes.length ? (
            generatedNodes.slice(0, 8).map((node) => (
              <MediaRow
                key={node.id}
                title={node.data.title}
                subtitle={node.data.output?.modelLabel ?? node.data.output?.status ?? node.data.subtitle ?? 'Generated clip'}
                actionLabel="Insert"
                onAction={() => onInsertGeneratedClip(node.id)}
              />
            ))
          ) : (
            <p className={styles.projectMediaEmpty}>Generated clips will appear here.</p>
          )}
        </div>
      </section>

      <section className={styles.projectMediaSection} aria-label="Timeline assets">
        <div className={styles.sectionHeading}>
          <span>Timeline assets</span>
          <span>{timelineItems.length}</span>
        </div>
        <div className={styles.projectMediaCard}>
          <Layers3 size={15} />
          <div>
            <strong>Active edit</strong>
            <span>{timelineItems.length} timeline clip{timelineItems.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </section>

      <div className={styles.projectMediaFooter}>
        <FolderOpen size={14} />
        <span>Project assets can be used from the canvas or the timeline.</span>
      </div>
    </aside>
  );
}
