'use client';

import { AudioLines, FileVideo2, Film, Folder, FolderPlus, ImageIcon, Layers3, LayoutGrid, ListFilter, MoreHorizontal, Plus, Search, Sparkles, Trash2, Upload, Video } from 'lucide-react';
import { type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import baseStyles from '../maxvideoai-editor.module.css';
import mediaStyles from '../_styles/media.module.css';
import {
  formatProjectMediaDuration,
  projectMediaSelectionKey,
  useProjectMediaController,
  type ProjectMediaContextMenu,
  type WorkspaceProjectSequenceSummary,
} from '../_controllers/useProjectMediaController';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphNode,
  WorkspaceProjectMediaFolder,
  WorkspaceTimelineItem,
} from '../_lib/workspace-types';

export type { WorkspaceProjectSequenceSummary };

const styles = { ...baseStyles, ...mediaStyles };

type TimelineProjectSidebarProps = {
  nodes: WorkspaceGraphNode[];
  projectAssets: WorkspaceAssetRecord[];
  projectMediaFolders: WorkspaceProjectMediaFolder[];
  projectName: string;
  sequences: WorkspaceProjectSequenceSummary[];
  timelineItems: WorkspaceTimelineItem[];
  onDeleteGeneratedClip: (nodeId: string) => void;
  onDeleteProjectAsset: (assetId: string) => void;
  onDeleteProjectMediaFolder: (folderId: string) => void;
  onDeleteSequence: (sequenceId: string) => void;
  onDuplicateSequence: (sequenceId: string) => void;
  onImportMedia: () => void;
  onInspectSequence: (sequenceId: string) => void;
  onInsertGeneratedClip: (nodeId: string) => void;
  onInsertProjectAsset: (assetId: string) => void;
  onMoveGeneratedClipToFolder: (nodeId: string) => void;
  onMoveProjectAssetToFolder: (assetId: string) => void;
  onNewFolder: () => void;
  onNewSequence: () => void;
  onRenameProjectMediaFolder: (folderId: string) => void;
  onSelectSequence: (sequenceId: string) => void;
  onClearSequenceInspector: () => void;
};

const MEDIA_DETAIL_SEPARATOR = ' • ';
const AUDIO_WAVEFORM_BARS = [34, 58, 42, 76, 48, 68, 92, 50, 74, 44, 82, 60, 96, 54, 70, 38, 64, 88, 46, 72, 56, 84];

function ProjectMediaBadge({ kind }: { kind: 'audio' | 'folder' | 'generated' | 'image' | 'sequence' | 'video' }) {
  const icon =
    kind === 'audio' ? <AudioLines size={15} /> :
    kind === 'folder' ? <Folder size={15} /> :
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
  kind: 'audio' | 'folder' | 'generated' | 'image' | 'sequence' | 'video';
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
        <span className={styles.projectMediaDurationBadge}>{formatProjectMediaDuration(durationSec)}</span>
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
  kind: 'audio' | 'folder' | 'generated' | 'image' | 'sequence' | 'video';
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
  canMoveMediaToFolder,
  menu,
  onClose,
  onDelete,
  onDuplicate,
  onInsert,
  onMove,
  onRename,
}: {
  canMoveMediaToFolder: boolean;
  menu: ProjectMediaContextMenu | null;
  onClose: () => void;
  onDelete: (menu: ProjectMediaContextMenu) => void;
  onDuplicate: (menu: ProjectMediaContextMenu) => void;
  onInsert: (menu: ProjectMediaContextMenu) => void;
  onMove: (menu: ProjectMediaContextMenu) => void;
  onRename: (menu: ProjectMediaContextMenu) => void;
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
        {menu.type === 'sequence' ? <Film size={13} /> : menu.type === 'folder' ? <Folder size={13} /> : <Plus size={13} />}
        {menu.type === 'sequence' ? 'Open sequence' : menu.type === 'folder' ? 'Open folder' : 'Insert at playhead'}
      </button>
      {menu.type === 'sequence' ? (
        <button type="button" role="menuitem" onClick={() => {
          onDuplicate(menu);
          onClose();
        }}>
          <FileVideo2 size={13} />
          Duplicate
        </button>
      ) : null}
      {menu.type === 'folder' ? (
        <button type="button" role="menuitem" onClick={() => {
          onRename(menu);
          onClose();
        }}>
          <FolderPlus size={13} />
          Rename folder
        </button>
      ) : null}
      {canMoveMediaToFolder && (menu.type === 'asset' || menu.type === 'generated') ? (
        <button type="button" role="menuitem" onClick={() => {
          onMove(menu);
          onClose();
        }}>
          <Folder size={13} />
          Move to folder
        </button>
      ) : null}
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

export function TimelineProjectSidebar({
  nodes,
  projectAssets,
  projectMediaFolders,
  projectName,
  sequences,
  onDeleteGeneratedClip,
  onDeleteProjectAsset,
  onDeleteProjectMediaFolder,
  onDeleteSequence,
  onDuplicateSequence,
  onImportMedia,
  onInspectSequence,
  onInsertGeneratedClip,
  onInsertProjectAsset,
  onMoveGeneratedClipToFolder,
  onMoveProjectAssetToFolder,
  onNewFolder,
  onNewSequence,
  onRenameProjectMediaFolder,
  onSelectSequence,
  onClearSequenceInspector,
}: TimelineProjectSidebarProps) {
  const projectMedia = useProjectMediaController({
    nodes,
    projectAssets,
    projectMediaFolders,
    sequences,
    onClearSequenceInspector,
    onDeleteGeneratedClip,
    onDeleteProjectAsset,
    onDeleteProjectMediaFolder,
    onDeleteSequence,
    onDuplicateSequence,
    onImportMedia,
    onInspectSequence,
    onInsertGeneratedClip,
    onInsertProjectAsset,
    onMoveGeneratedClipToFolder,
    onMoveProjectAssetToFolder,
    onRenameProjectMediaFolder,
    onSelectSequence,
  });

  return (
    <aside className={`${styles.librarySidebar} ${styles.timelineProjectSidebar}`} aria-label="Project media library">
      <div className={styles.projectMediaHeader}>
        <div className={styles.projectMediaHeaderCopy}>
          <p className={styles.projectMediaTitle}>Project media</p>
          <span className={styles.projectMediaSubtitle}>Assets, sequences and generated clips</span>
        </div>
        <button type="button" className={styles.projectMediaActionButton} onClick={projectMedia.importMedia}>
          <Upload size={16} />
          Import media
        </button>
      </div>
      <div className={styles.projectMediaControls}>
        <label className={styles.projectMediaSearch}>
          <Search size={14} />
          <span>Search media</span>
          <input
            type="search"
            value={projectMedia.searchQuery}
            onChange={(event) => projectMedia.setSearchQuery(event.currentTarget.value)}
            placeholder="Search media..."
          />
        </label>
        <div className={styles.projectMediaViewTools} aria-label="Project media view tools">
          <button type="button" aria-label="Filter media">
            <ListFilter size={14} />
          </button>
          <button type="button" aria-label="Grid view" aria-pressed="true">
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>
      {projectMedia.activeFolder ? (
        <div className={styles.projectMediaBreadcrumb}>
          <button type="button" onClick={projectMedia.openRootFolder}>Project media</button>
          <span>/</span>
          <strong>{projectMedia.activeFolder.name}</strong>
        </div>
      ) : null}

      <div className={styles.projectMediaGrid} aria-label={`${projectName} project media`}>
        {projectMedia.visibleSequences.map((sequence) => (
          <ProjectMediaCard
            key={sequence.id}
            ariaPressed={sequence.isActive}
            dataProjectSequenceId={sequence.id}
            id={projectMediaSelectionKey('sequence', sequence.id)}
            isSelected={projectMedia.selectedKey === projectMediaSelectionKey('sequence', sequence.id) || sequence.isActive}
            kind="sequence"
            onClick={() => projectMedia.selectSequence(sequence.id)}
            onContextMenu={(event) => projectMedia.openContextMenu(event, { id: sequence.id, title: sequence.name, type: 'sequence' })}
            subtitle={`${formatProjectMediaDuration(sequence.durationSec)}${MEDIA_DETAIL_SEPARATOR}${sequence.clipCount} clip${sequence.clipCount === 1 ? '' : 's'}${MEDIA_DETAIL_SEPARATOR}${sequence.settings.aspectRatio}`}
            thumbnailUrl={sequence.previewUrl}
            title={sequence.name}
          />
        ))}

        {projectMedia.visibleFolders.map(({ folder, key, subtitle }) => (
          <div key={folder.id} data-project-media-folder-id={folder.id}>
            <ProjectMediaCard
              id={key}
              isSelected={projectMedia.selectedKey === key}
              kind="folder"
              onClick={() => projectMedia.selectProjectMediaFolder(folder.id)}
              onContextMenu={(event) => projectMedia.openContextMenu(event, { id: folder.id, title: folder.name, type: 'folder' })}
              subtitle={subtitle}
              title={folder.name}
            />
          </div>
        ))}

        {projectMedia.visibleProjectAssets.map(({ asset, cardKind, key, mediaKind, subtitle, thumbnailUrl, timelineDurationSec }) => {
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
                isSelected={projectMedia.selectedKey === key}
                kind={cardKind}
                onClick={() => projectMedia.selectProjectAsset(asset.id)}
                onContextMenu={(event) => projectMedia.openContextMenu(event, { id: asset.id, title: asset.filename, type: 'asset' })}
                onDragStart={mediaKind ? (event) => projectMedia.beginProjectAssetTimelineDrag(event, asset) : undefined}
                durationSec={asset.durationSec}
                subtitle={subtitle}
                thumbnailUrl={thumbnailUrl}
                title={asset.filename}
              />
            </div>
          );
        })}

        {projectMedia.visibleGeneratedNodes.map(({ key, mediaKind, node, subtitle, thumbnailUrl, timelineDurationSec }) => {
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
                isSelected={projectMedia.selectedKey === key}
                kind="generated"
                onClick={() => projectMedia.selectGeneratedNode(node.id)}
                onContextMenu={(event) => projectMedia.openContextMenu(event, { id: node.id, title: node.data.title, type: 'generated' })}
                onDragStart={mediaKind ? (event) => projectMedia.beginGeneratedNodeTimelineDrag(event, node) : undefined}
                durationSec={node.data.output?.durationSec}
                subtitle={subtitle}
                thumbnailUrl={thumbnailUrl}
                title={node.data.title}
              />
            </div>
          );
        })}

        {!projectMedia.totalItems || (!projectMedia.visibleSequences.length && !projectMedia.visibleFolders.length && !projectMedia.visibleProjectAssets.length && !projectMedia.visibleGeneratedNodes.length) ? (
          <p className={styles.projectMediaEmpty}>
            {projectMedia.totalItems ? (projectMedia.activeFolder ? 'This folder is empty.' : 'No media matches this search.') : 'Import media or create a sequence to start.'}
          </p>
        ) : null}
      </div>

      <div className={styles.projectMediaFooterBar}>
        <div className={styles.projectMediaItemCount}>
          <Layers3 size={16} />
          <span>{projectMedia.visibleItemCount} item{projectMedia.visibleItemCount === 1 ? '' : 's'}</span>
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
          <ProjectMediaFooterAction danger disabled={!projectMedia.selectedCanDelete} onClick={projectMedia.deleteSelected}>
            <Trash2 size={15} />
            Delete
          </ProjectMediaFooterAction>
        </div>
      </div>

      <ProjectMediaContextMenu
        canMoveMediaToFolder={projectMedia.canMoveMediaToFolder}
        menu={projectMedia.contextMenu}
        onClose={() => projectMedia.setContextMenu(null)}
        onDelete={projectMedia.deleteMenuItem}
        onDuplicate={projectMedia.duplicateMenuItem}
        onInsert={projectMedia.insertMenuItem}
        onMove={projectMedia.moveMenuItem}
        onRename={projectMedia.renameMenuItem}
      />
    </aside>
  );
}
