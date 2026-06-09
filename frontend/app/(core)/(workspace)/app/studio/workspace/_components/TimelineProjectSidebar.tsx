'use client';

import { AudioLines, FileVideo2, Film, FolderPlus, ImageIcon, Layers3, MoreHorizontal, Plus, Sparkles, Trash2, Upload, Video } from 'lucide-react';
import { useEffect, useState, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import styles from '../maxvideoai-editor.module.css';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphNode,
  WorkspaceProjectSettings,
  WorkspaceTimelineItem,
} from '../_lib/workspace-types';
import { workspaceAssetTimelineDuration, workspaceOutputTimelineDuration } from '../_lib/workspace-timeline-editing';

export type WorkspaceProjectSequenceSummary = {
  id: string;
  name: string;
  durationSec: number;
  clipCount: number;
  settings: WorkspaceProjectSettings;
  isActive: boolean;
  previewUrl?: string | null;
};

type TimelineProjectSidebarProps = {
  nodes: WorkspaceGraphNode[];
  projectAssets: WorkspaceAssetRecord[];
  projectName: string;
  sequences: WorkspaceProjectSequenceSummary[];
  timelineItems: WorkspaceTimelineItem[];
  onDeleteGeneratedClip: (nodeId: string) => void;
  onDeleteProjectAsset: (assetId: string) => void;
  onImportMedia: () => void;
  onInsertGeneratedClip: (nodeId: string) => void;
  onInsertProjectAsset: (assetId: string) => void;
  onNewFolder: () => void;
  onNewSequence: () => void;
  onSelectSequence: (sequenceId: string) => void;
};

const TIMELINE_NODE_DRAG_TYPE = 'application/x-maxvideoai-timeline-node';
const MEDIA_DETAIL_SEPARATOR = ' • ';
const AUDIO_WAVEFORM_BARS = [34, 58, 42, 76, 48, 68, 92, 50, 74, 44, 82, 60, 96, 54, 70, 38, 64, 88, 46, 72, 56, 84];

type ProjectMediaSelection =
  | { id: string; type: 'asset' | 'generated' | 'sequence' }
  | null;

type ProjectMediaContextMenu = {
  id: string;
  title: string;
  type: 'asset' | 'generated';
  x: number;
  y: number;
};

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

function timelineMediaKindForGeneratedNode(node: WorkspaceGraphNode): 'audio' | 'image' | 'video' | null {
  const output = node.data.output;
  if (!output || output.status === 'placeholder' || output.status === 'processing' || output.status === 'failed') return null;
  if (output.kind === 'audio') return output.url ? 'audio' : null;
  if (output.kind === 'image') return output.url || output.thumbUrl ? 'image' : null;
  return output.url ? 'video' : null;
}

function beginProjectAssetTimelineDrag(event: ReactDragEvent<HTMLElement>, asset: WorkspaceAssetRecord): void {
  const mediaKind = timelineMediaKindForProjectAsset(asset);
  if (!mediaKind) return;
  const title = asset.filename;
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData(TIMELINE_NODE_DRAG_TYPE, JSON.stringify({
    assetId: asset.id,
    durationSec: workspaceAssetTimelineDuration(asset),
    mediaKind,
    previewUrl: assetThumbnailUrl(asset),
    title,
  }));
  event.dataTransfer.setData('text/plain', title);
}

function beginGeneratedNodeTimelineDrag(event: ReactDragEvent<HTMLElement>, node: WorkspaceGraphNode): void {
  const mediaKind = timelineMediaKindForGeneratedNode(node);
  const output = node.data.output;
  if (!mediaKind || !output) return;
  const title = node.data.title;
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData(TIMELINE_NODE_DRAG_TYPE, JSON.stringify({
    durationSec: workspaceOutputTimelineDuration(output),
    nodeId: node.id,
    mediaKind,
    previewUrl: generatedThumbnailUrl(node),
    title,
  }));
  event.dataTransfer.setData('text/plain', title);
}

function mediaSubtitleForAsset(asset: WorkspaceAssetRecord): string {
  if (asset.kind === 'audio') {
    return [asset.durationSec ? formatDuration(asset.durationSec) : null, '48kHz'].filter(Boolean).join(MEDIA_DETAIL_SEPARATOR);
  }
  if (asset.kind === 'video') {
    return [asset.durationSec ? formatDuration(asset.durationSec) : null, asset.dimensions, '16:9'].filter(Boolean).join(MEDIA_DETAIL_SEPARATOR);
  }
  return asset.dimensions ?? asset.subtitle;
}

function mediaSubtitleForGeneratedNode(node: WorkspaceGraphNode): string {
  const output = node.data.output;
  if (!output) return node.data.subtitle ?? 'Generated clip';
  return [output.durationSec ? formatDuration(output.durationSec) : null, output.modelLabel].filter(Boolean).join(MEDIA_DETAIL_SEPARATOR);
}

function ProjectMediaBadge({ kind }: { kind: 'audio' | 'generated' | 'image' | 'sequence' | 'video' }) {
  const icon =
    kind === 'audio' ? <AudioLines size={15} /> :
    kind === 'image' ? <ImageIcon size={15} /> :
    kind === 'generated' ? <Sparkles size={15} /> :
    kind === 'sequence' ? <Film size={15} /> :
    <Video size={15} />;

  return (
    <span className={`${styles.projectMediaBadge} ${styles[`projectMediaBadge${kind[0].toUpperCase()}${kind.slice(1)}`]}`}>
      {icon}
    </span>
  );
}

function ProjectMediaArtwork({
  durationSec,
  kind,
  title,
  url,
}: {
  durationSec?: number;
  kind: 'audio' | 'generated' | 'image' | 'sequence' | 'video';
  title: string;
  url?: string | null;
}) {
  return (
    <div className={`${styles.projectMediaArtwork} ${styles[`projectMediaArtwork${kind[0].toUpperCase()}${kind.slice(1)}`]}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" draggable={false} />
      ) : kind === 'audio' ? (
        <div className={styles.projectMediaWaveform} aria-hidden="true">
          {AUDIO_WAVEFORM_BARS.map((height, index) => (
            <span key={`${title}-${index}`} style={{ height: `${height}%` }} />
          ))}
        </div>
      ) : (
        <div className={styles.projectMediaPosterFallback} aria-hidden="true" />
      )}
      <ProjectMediaBadge kind={kind} />
      {durationSec && kind !== 'audio' ? (
        <span className={styles.projectMediaDurationBadge}>{formatDuration(durationSec)}</span>
      ) : null}
    </div>
  );
}

function ProjectMediaCard({
  ariaPressed,
  canDrag,
  children,
  dataProjectSequenceId,
  dragKind,
  durationSec,
  id,
  isSelected,
  kind,
  onClick,
  onContextMenu,
  onDragStart,
  subtitle,
  thumbnailUrl,
  title,
}: {
  ariaPressed?: boolean;
  canDrag?: boolean;
  children?: ReactNode;
  dataProjectSequenceId?: string;
  dragKind?: 'audio' | 'image' | 'video';
  durationSec?: number;
  id: string;
  isSelected: boolean;
  kind: 'audio' | 'generated' | 'image' | 'sequence' | 'video';
  onClick: () => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void;
  onDragStart?: (event: ReactDragEvent<HTMLElement>) => void;
  subtitle: string;
  thumbnailUrl?: string | null;
  title: string;
}) {
  return (
    <div
      className={`${styles.projectMediaTile} ${isSelected ? styles.projectMediaTileSelected : ''}`}
      aria-pressed={ariaPressed}
      data-project-media-card={id}
      data-project-media-drag-kind={canDrag ? dragKind ?? kind : undefined}
      data-project-sequence-id={dataProjectSequenceId}
      draggable={Boolean(canDrag)}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onKeyDown={(event: ReactKeyboardEvent<HTMLElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onClick();
      }}
      role="button"
      tabIndex={0}
    >
      <ProjectMediaArtwork durationSec={durationSec} kind={kind} title={title} url={thumbnailUrl} />
      <div className={styles.projectMediaTileBody}>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      {children}
      {onContextMenu ? (
        <button type="button" className={styles.projectMediaMoreButton} aria-label={`More actions for ${title}`} onClick={(event) => {
          event.stopPropagation();
          onContextMenu(event);
        }}>
          <MoreHorizontal size={16} />
        </button>
      ) : null}
    </div>
  );
}

function ProjectMediaContextMenu({
  menu,
  onClose,
  onDelete,
  onInsert,
}: {
  menu: ProjectMediaContextMenu | null;
  onClose: () => void;
  onDelete: (menu: ProjectMediaContextMenu) => void;
  onInsert: (menu: ProjectMediaContextMenu) => void;
}) {
  if (!menu) return null;
  return (
    <div
      className={styles.projectMediaContextMenu}
      data-project-media-menu="true"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      aria-label={`${menu.title} actions`}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span>{menu.title}</span>
      <button type="button" role="menuitem" onClick={() => {
        onInsert(menu);
        onClose();
      }}>
        <Plus size={13} />
        Insert at playhead
      </button>
      <button type="button" role="menuitem" className={styles.projectMediaDangerAction} onClick={() => {
        onDelete(menu);
        onClose();
      }}>
        <Trash2 size={13} />
        Delete
      </button>
    </div>
  );
}

function ProjectMediaFooterAction({
  children,
  danger,
  dataProjectSequenceCreate,
  disabled,
  onClick,
}: {
  children: ReactNode;
  danger?: boolean;
  dataProjectSequenceCreate?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.projectMediaFooterAction} ${danger ? styles.projectMediaFooterDangerAction : ''}`}
      data-project-sequence-create={dataProjectSequenceCreate ? 'true' : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function mediaCardKindForAsset(asset: WorkspaceAssetRecord): 'audio' | 'image' | 'video' {
  if (asset.kind === 'audio') return 'audio';
  if (asset.kind === 'video') return 'video';
  return 'image';
}

function generatedThumbnailUrl(node: WorkspaceGraphNode): string | null {
  const output = node.data.output;
  return output?.thumbUrl ?? output?.url ?? null;
}

function assetThumbnailUrl(asset: WorkspaceAssetRecord): string | null {
  if (asset.kind === 'audio') return null;
  return asset.thumbUrl ?? asset.url ?? null;
}

function selectionKey(type: NonNullable<ProjectMediaSelection>['type'], id: string): string {
  return `${type}:${id}`;
}

export function TimelineProjectSidebar({
  nodes,
  projectAssets,
  projectName,
  sequences,
  onDeleteGeneratedClip,
  onDeleteProjectAsset,
  onImportMedia,
  onInsertGeneratedClip,
  onInsertProjectAsset,
  onNewFolder,
  onNewSequence,
  onSelectSequence,
}: TimelineProjectSidebarProps) {
  const generatedNodes = generatedClipNodes(nodes);
  const [selectedMedia, setSelectedMedia] = useState<ProjectMediaSelection>(null);
  const [contextMenu, setContextMenu] = useState<ProjectMediaContextMenu | null>(null);

  const totalItems = sequences.length + projectAssets.length + generatedNodes.length;
  const selectedKey = selectedMedia ? selectionKey(selectedMedia.type, selectedMedia.id) : null;
  const selectedCanDelete = selectedMedia?.type === 'asset' || selectedMedia?.type === 'generated';

  const openContextMenu = (event: ReactMouseEvent<HTMLElement>, menu: Omit<ProjectMediaContextMenu, 'x' | 'y'>) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedMedia({ id: menu.id, type: menu.type });
    setContextMenu({
      ...menu,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleInsertMenuItem = (menu: ProjectMediaContextMenu) => {
    if (menu.type === 'asset') onInsertProjectAsset(menu.id);
    else onInsertGeneratedClip(menu.id);
  };

  const handleDeleteMenuItem = (menu: ProjectMediaContextMenu) => {
    if (menu.type === 'asset') onDeleteProjectAsset(menu.id);
    else onDeleteGeneratedClip(menu.id);
    setSelectedMedia(null);
  };

  const handleDeleteSelected = () => {
    if (!selectedMedia || !selectedCanDelete) return;
    if (selectedMedia.type === 'asset') onDeleteProjectAsset(selectedMedia.id);
    if (selectedMedia.type === 'generated') onDeleteGeneratedClip(selectedMedia.id);
    setSelectedMedia(null);
  };

  useEffect(() => {
    if (!contextMenu) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-project-media-menu="true"]')) return;
      setContextMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  return (
    <aside className={`${styles.librarySidebar} ${styles.timelineProjectSidebar}`} aria-label="Project media library">
      <div className={styles.projectMediaHeader}>
        <div className={styles.projectMediaHeaderCopy}>
          <p className={styles.projectMediaTitle}>Project media</p>
          <span className={styles.projectMediaSubtitle}>Assets, sequences, clips</span>
        </div>
        <button type="button" className={styles.projectMediaActionButton} onClick={onImportMedia}>
          <Upload size={16} />
          Import media
        </button>
      </div>

      <div className={styles.projectMediaGrid} aria-label={`${projectName} project media`}>
        {sequences.map((sequence) => (
          <ProjectMediaCard
            key={sequence.id}
            ariaPressed={sequence.isActive}
            dataProjectSequenceId={sequence.id}
            id={selectionKey('sequence', sequence.id)}
            isSelected={selectedKey === selectionKey('sequence', sequence.id) || sequence.isActive}
            kind="sequence"
            onClick={() => {
              setSelectedMedia({ id: sequence.id, type: 'sequence' });
              onSelectSequence(sequence.id);
            }}
            subtitle={`${formatDuration(sequence.durationSec)}${MEDIA_DETAIL_SEPARATOR}${sequence.clipCount} clip${sequence.clipCount === 1 ? '' : 's'}${MEDIA_DETAIL_SEPARATOR}${sequence.settings.aspectRatio}`}
            thumbnailUrl={sequence.previewUrl}
            title={sequence.name}
          />
        ))}

        {projectAssets.map((asset) => {
          const mediaKind = timelineMediaKindForProjectAsset(asset);
          const cardKind = mediaCardKindForAsset(asset);
          const timelineDurationSec = workspaceAssetTimelineDuration(asset);
          const key = selectionKey('asset', asset.id);
          return (
            <div
              key={asset.id}
              data-project-media-asset-id={asset.id}
              data-project-media-drag-kind={mediaKind ?? undefined}
              data-project-media-duration-sec={mediaKind ? timelineDurationSec : undefined}
              data-project-media-title={asset.filename}
            >
              <ProjectMediaCard
                canDrag={Boolean(mediaKind)}
                dragKind={mediaKind ?? undefined}
                id={key}
                isSelected={selectedKey === key}
                kind={cardKind}
                onClick={() => setSelectedMedia({ id: asset.id, type: 'asset' })}
                onContextMenu={(event) => openContextMenu(event, { id: asset.id, title: asset.filename, type: 'asset' })}
                onDragStart={mediaKind ? (event) => beginProjectAssetTimelineDrag(event, asset) : undefined}
                durationSec={asset.durationSec}
                subtitle={mediaSubtitleForAsset(asset)}
                thumbnailUrl={assetThumbnailUrl(asset)}
                title={asset.filename}
              />
            </div>
          );
        })}

        {generatedNodes.map((node) => {
          const mediaKind = timelineMediaKindForGeneratedNode(node);
          const output = node.data.output;
          const timelineDurationSec = output ? workspaceOutputTimelineDuration(output) : undefined;
          const key = selectionKey('generated', node.id);
          return (
            <div
              key={node.id}
              data-project-media-generated-id={node.id}
              data-project-media-drag-kind={mediaKind ?? undefined}
              data-project-media-duration-sec={mediaKind ? timelineDurationSec : undefined}
              data-project-media-title={node.data.title}
            >
              <ProjectMediaCard
                canDrag={Boolean(mediaKind)}
                dragKind={mediaKind ?? undefined}
                id={key}
                isSelected={selectedKey === key}
                kind="generated"
                onClick={() => setSelectedMedia({ id: node.id, type: 'generated' })}
                onContextMenu={(event) => openContextMenu(event, { id: node.id, title: node.data.title, type: 'generated' })}
                onDragStart={mediaKind ? (event) => beginGeneratedNodeTimelineDrag(event, node) : undefined}
                durationSec={node.data.output?.durationSec}
                subtitle={mediaSubtitleForGeneratedNode(node)}
                thumbnailUrl={generatedThumbnailUrl(node)}
                title={node.data.title}
              />
            </div>
          );
        })}

        {!totalItems ? (
          <p className={styles.projectMediaEmpty}>Import media or create a sequence to start.</p>
        ) : null}
      </div>

      <div className={styles.projectMediaFooterBar}>
        <div className={styles.projectMediaItemCount}>
          <Layers3 size={16} />
          <span>{totalItems} item{totalItems === 1 ? '' : 's'}</span>
        </div>
        <div className={styles.projectMediaFooterActions}>
          <ProjectMediaFooterAction onClick={onNewFolder}>
            <FolderPlus size={15} />
            New folder
          </ProjectMediaFooterAction>
          <ProjectMediaFooterAction dataProjectSequenceCreate onClick={onNewSequence}>
            <FileVideo2 size={15} />
            New sequence
          </ProjectMediaFooterAction>
          <ProjectMediaFooterAction danger disabled={!selectedCanDelete} onClick={handleDeleteSelected}>
            <Trash2 size={15} />
            Delete
          </ProjectMediaFooterAction>
        </div>
      </div>

      <ProjectMediaContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onDelete={handleDeleteMenuItem}
        onInsert={handleInsertMenuItem}
      />
    </aside>
  );
}
