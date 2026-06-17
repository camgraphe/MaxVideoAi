'use client';

import { ArrowLeft, Check, FileVideo2, Film, Folder, FolderOpen, FolderPlus, Layers3, MoreHorizontal, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import baseStyles from '../maxvideoai-editor.module.css';
import mediaStyles from '../_styles/media.module.css';
import {
  formatProjectMediaDuration,
  type ProjectMediaKindFilter,
  projectMediaSelectionKey,
  useProjectMediaController,
  type ProjectMediaContextMenu,
  type ProjectMediaSelectionGesture,
  type WorkspaceProjectSequenceSummary,
} from '../_controllers/useProjectMediaController';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphNode,
  WorkspaceProjectMediaFolder,
  WorkspaceTimelineItem,
} from '../_lib/workspace-types';
import { StudioSegmentedControl } from './ui/StudioSegmentedControl';
import {
  localizeStudioGeneratedFolderDisplayName,
  localizeStudioGeneratedSequenceDisplayName,
  type StudioCopy,
} from '../../_lib/studio-copy';

export type { WorkspaceProjectSequenceSummary };

const styles = { ...baseStyles, ...mediaStyles };

type TimelineProjectSidebarProps = {
  studioCanvasNodeCopy: StudioCopy['canvas']['nodes'];
  copy: StudioCopy['viewer']['projectMedia'];
  nodes: WorkspaceGraphNode[];
  projectAssets: WorkspaceAssetRecord[];
  projectMediaFolders: WorkspaceProjectMediaFolder[];
  projectName: string;
  sequences: WorkspaceProjectSequenceSummary[];
  timelineItems: WorkspaceTimelineItem[];
  onDeleteGeneratedClip: (nodeId: string) => void;
  onDeleteGeneratedClips: (nodeIds: string[]) => void;
  onDeleteProjectAsset: (assetId: string) => void;
  onDeleteProjectAssets: (assetIds: string[]) => void;
  onDeleteProjectMediaFolder: (folderId: string) => void;
  onDeleteProjectMediaFolders: (folderIds: string[]) => void;
  onDeleteSequence: (sequenceId: string) => void;
  onDeleteSequences: (sequenceIds: string[]) => void;
  onDuplicateSequence: (sequenceId: string) => void;
  onImportMedia: (folderId?: string | null) => void;
  onImportLocalMediaFiles: (files: File[], folderId?: string | null) => Promise<void> | void;
  onInspectProjectAsset: (assetId: string) => void;
  onInspectSequence: (sequenceId: string) => void;
  onInsertGeneratedClip: (nodeId: string) => void;
  onInsertProjectAsset: (assetId: string) => void;
  onMoveGeneratedClipToFolder: (nodeId: string, folderId: string | null) => void;
  onMoveProjectAssetToFolder: (assetId: string, folderId: string | null) => void;
  onNewFolder: (requestedName?: string) => void;
  onNewSequence: () => void;
  onRenameProjectMediaFolder: (folderId: string, requestedName: string) => void;
  onSelectSequence: (sequenceId: string) => void;
  onClearProjectMediaInspector: () => void;
};

const MEDIA_DETAIL_SEPARATOR = ' • ';
const AUDIO_WAVEFORM_BARS = [34, 58, 42, 76, 48, 68, 92, 50, 74, 44, 82, 60, 96, 54, 70, 38, 64, 88, 46, 72, 56, 84];

type ProjectMediaFolderDialogState =
  | { initialName: string; type: 'create' }
  | { folderId: string; initialName: string; type: 'rename' }
  | { currentFolderId: string | null; itemId: string; itemType: 'asset' | 'generated'; title: string; type: 'move' };

function formatCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function ProjectMediaArtwork({
  kind,
  title,
  url,
}: {
  kind: 'audio' | 'folder' | 'generated' | 'image' | 'sequence' | 'video';
  title: string;
  url?: string | null;
}) {
  return (
    <div className={`${styles.projectMediaArtwork} ${styles[`projectMediaArtwork${kind[0].toUpperCase()}${kind.slice(1)}`]}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" draggable={false} />
      ) : kind === 'folder' ? (
        <div className={styles.projectMediaFolderGlyph} aria-hidden="true">
          <FolderOpen size={30} />
        </div>
      ) : kind === 'audio' ? (
        <div className={styles.projectMediaWaveform} aria-hidden="true">
          {AUDIO_WAVEFORM_BARS.map((height, index) => (
            <span key={`${title}-${index}`} style={{ height: `${height}%` }} />
          ))}
        </div>
      ) : (
        <div className={styles.projectMediaPosterFallback} aria-hidden="true" />
      )}
    </div>
  );
}

function ProjectMediaCard({
  copy,
  ariaPressed,
  canDrag,
  children,
  dataProjectSequenceId,
  dragKind,
  id,
  isSelected,
  isSelectionSelected,
  kind,
  onClick,
  onContextMenu,
  contextMenuOpen,
  contextMenuToken,
  onDragEnd,
  onDragLeave,
  onDragOver,
  onDragStart,
  onDrop,
  subtitle,
  thumbnailUrl,
  title,
}: {
  copy: StudioCopy['viewer']['projectMedia'];
  ariaPressed?: boolean;
  canDrag?: boolean;
  children?: ReactNode;
  dataProjectSequenceId?: string;
  dragKind?: 'audio' | 'image' | 'video';
  id: string;
  isSelected: boolean;
  isSelectionSelected?: boolean;
  kind: 'audio' | 'folder' | 'generated' | 'image' | 'sequence' | 'video';
  onClick: (gesture: ProjectMediaSelectionGesture) => void;
  contextMenuOpen?: boolean;
  contextMenuToken?: string;
  onContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void;
  onDragStart?: (event: ReactDragEvent<HTMLElement>) => void;
  onDragEnd?: () => void;
  onDragLeave?: (event: ReactDragEvent<HTMLElement>) => void;
  onDragOver?: (event: ReactDragEvent<HTMLElement>) => void;
  onDrop?: (event: ReactDragEvent<HTMLElement>) => void;
  subtitle: string;
  thumbnailUrl?: string | null;
  title: string;
}) {
  const isSelectionActive = isSelectionSelected ?? isSelected;

  return (
    <div className={styles.projectMediaTileFrame}>
      <div
        className={`${styles.projectMediaTile} ${isSelected ? styles.projectMediaTileSelected : ''}`}
        aria-current={ariaPressed ? 'true' : undefined}
        aria-pressed={Boolean(ariaPressed || isSelectionActive)}
        data-project-media-card="true"
        data-project-media-card-id={id}
        data-project-media-drag-kind={canDrag ? dragKind ?? kind : undefined}
        data-project-sequence-id={dataProjectSequenceId}
        data-selected={isSelectionActive ? 'true' : undefined}
        draggable={Boolean(canDrag)}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onDragEnd={onDragEnd}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDragStart={onDragStart}
        onDrop={onDrop}
        onKeyDown={(event: ReactKeyboardEvent<HTMLElement>) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onClick(event);
        }}
        role="button"
        tabIndex={0}
      >
        <ProjectMediaArtwork kind={kind} title={title} url={thumbnailUrl} />
        <div className={styles.projectMediaTileBody}>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        {children}
      </div>
      {onContextMenu ? (
        <button type="button" className={styles.projectMediaMoreButton} aria-label={formatCopyValue(copy.moreActions, { title })} onClick={(event) => {
          event.stopPropagation();
          onContextMenu(event);
        }} aria-haspopup="menu" aria-controls="project-media-context-menu" aria-expanded={contextMenuOpen} data-project-media-menu-trigger={contextMenuToken}>
          <MoreHorizontal size={16} />
        </button>
      ) : null}
    </div>
  );
}

function ProjectMediaContextMenu({
  copy,
  canMoveMediaToFolder,
  menu,
  onClose,
  onDelete,
  onDuplicate,
  onInsert,
  onMove,
  onRename,
}: {
  copy: StudioCopy['viewer']['projectMedia'];
  canMoveMediaToFolder: boolean;
  menu: ProjectMediaContextMenu | null;
  onClose: () => void;
  onDelete: (menu: ProjectMediaContextMenu) => void;
  onDuplicate: (menu: ProjectMediaContextMenu) => void;
  onInsert: (menu: ProjectMediaContextMenu) => void;
  onMove: (menu: ProjectMediaContextMenu) => void;
  onRename: (menu: ProjectMediaContextMenu) => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) return;
    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [menu]);

  if (!menu) return null;

  const focusTrigger = () => {
    document.querySelector<HTMLElement>(`[data-project-media-menu-trigger="${menu.type}:${menu.id}"]`)?.focus();
  };

  const menuItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const moveMenuFocus = (direction: 1 | -1) => {
    const items = menuItems();
    if (!items.length) return;
    const currentIndex = Math.max(0, items.findIndex((item) => item === document.activeElement));
    items[(currentIndex + direction + items.length) % items.length]?.focus();
  };
  const closeAndFocusTrigger = () => {
    onClose();
    window.requestAnimationFrame(focusTrigger);
  };

  return (
    <div
      ref={menuRef}
      id="project-media-context-menu"
      className={styles.projectMediaContextMenu}
      data-project-media-menu="true"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      aria-label={formatCopyValue(copy.actionsLabel, { title: menu.title })}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeAndFocusTrigger();
          return;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          moveMenuFocus(1);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          moveMenuFocus(-1);
          return;
        }
        if (event.key === 'Home') {
          event.preventDefault();
          menuItems()[0]?.focus();
          return;
        }
        if (event.key === 'End') {
          event.preventDefault();
          menuItems().at(-1)?.focus();
        }
      }}
    >
      <span>{menu.title}</span>
      <button type="button" role="menuitem" onClick={() => {
        onInsert(menu);
        onClose();
      }}>
        {menu.type === 'sequence' ? <Film size={13} /> : menu.type === 'folder' ? <Folder size={13} /> : <Plus size={13} />}
        {menu.type === 'sequence' ? copy.openSequence : menu.type === 'folder' ? copy.openFolder : copy.insertAtPlayhead}
      </button>
      {menu.type === 'sequence' ? (
        <button type="button" role="menuitem" onClick={() => {
          onDuplicate(menu);
          onClose();
        }}>
          <FileVideo2 size={13} />
          {copy.duplicate}
        </button>
      ) : null}
      {menu.type === 'folder' ? (
        <button type="button" role="menuitem" onClick={() => {
          onRename(menu);
          onClose();
        }}>
          <FolderPlus size={13} />
          {copy.renameFolder}
        </button>
      ) : null}
      {canMoveMediaToFolder && (menu.type === 'asset' || menu.type === 'generated') ? (
        <button type="button" role="menuitem" onClick={() => {
          onMove(menu);
          onClose();
        }}>
          <Folder size={13} />
          {copy.moveToFolder}
        </button>
      ) : null}
      <button type="button" role="menuitem" className={styles.projectMediaDangerAction} onClick={() => {
        onDelete(menu);
        onClose();
      }}>
        <Trash2 size={13} />
        {copy.delete}
      </button>
    </div>
  );
}

function ProjectMediaFolderDialog({
  copy,
  dialog,
  folders,
  onClose,
  onCreateFolder,
  onMoveMedia,
  onRenameFolder,
}: {
  copy: StudioCopy['viewer']['projectMedia'];
  dialog: ProjectMediaFolderDialogState | null;
  folders: WorkspaceProjectMediaFolder[];
  onClose: () => void;
  onCreateFolder: (requestedName: string) => void;
  onMoveMedia: (dialog: Extract<ProjectMediaFolderDialogState, { type: 'move' }>, folderId: string | null) => void;
  onRenameFolder: (folderId: string, requestedName: string) => void;
}) {
  const [folderName, setFolderName] = useState('');
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (!dialog) return;
    if (dialog.type === 'move') {
      setTargetFolderId(dialog.currentFolderId ?? null);
      return;
    }
    setFolderName(dialog.initialName);
  }, [dialog]);

  if (!dialog) return null;

  const isMoveDialog = dialog.type === 'move';
  const title = dialog.type === 'create' ? copy.newFolder : dialog.type === 'rename' ? copy.renameFolder : copy.moveDialogTitle;
  const description = dialog.type === 'move'
    ? formatCopyValue(copy.moveDialogDescription, { title: dialog.title })
    : copy.folderDialogDescription;
  const trimmedName = folderName.trim();
  const canSubmit = isMoveDialog || trimmedName.length > 0;

  return (
    <div
      className={styles.projectMediaDialogOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className={styles.projectMediaDialog}
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          if (dialog.type === 'create') onCreateFolder(trimmedName);
          else if (dialog.type === 'rename') onRenameFolder(dialog.folderId, trimmedName);
          else onMoveMedia(dialog, targetFolderId);
          onClose();
        }}
      >
        <div className={styles.projectMediaDialogHeader}>
          <div>
            <p>{title}</p>
            <span>{description}</span>
          </div>
          <button type="button" onClick={onClose} aria-label={copy.closeDialog}>
            <X size={15} />
          </button>
        </div>

        {isMoveDialog ? (
          <div className={styles.projectMediaFolderList} role="radiogroup" aria-label={copy.folderDestination}>
            <button
              type="button"
              className={targetFolderId === null ? styles.projectMediaFolderOptionSelected : ''}
              aria-checked={targetFolderId === null}
              role="radio"
              onClick={() => setTargetFolderId(null)}
            >
              <FolderOpen size={15} />
              <span>{copy.title}</span>
              {targetFolderId === null ? <Check size={14} /> : null}
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                className={targetFolderId === folder.id ? styles.projectMediaFolderOptionSelected : ''}
                aria-checked={targetFolderId === folder.id}
                role="radio"
                onClick={() => setTargetFolderId(folder.id)}
            >
              <Folder size={15} />
                <span>{localizeStudioGeneratedFolderDisplayName(folder.name, copy)}</span>
                {targetFolderId === folder.id ? <Check size={14} /> : null}
              </button>
            ))}
          </div>
        ) : (
          <label className={styles.projectMediaDialogField}>
            <span>{copy.folderName}</span>
            <input
              autoFocus
              value={folderName}
              onChange={(event) => setFolderName(event.currentTarget.value)}
              maxLength={60}
            />
          </label>
        )}

        <div className={styles.projectMediaDialogActions}>
          <button type="button" onClick={onClose}>{copy.cancel}</button>
          <button type="submit" disabled={!canSubmit}>
            {dialog.type === 'create' ? copy.create : dialog.type === 'rename' ? copy.rename : copy.move}
          </button>
        </div>
      </form>
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
  studioCanvasNodeCopy,
  copy,
  nodes,
  projectAssets,
  projectMediaFolders,
  projectName,
  sequences,
  onDeleteGeneratedClip,
  onDeleteGeneratedClips,
  onDeleteProjectAsset,
  onDeleteProjectAssets,
  onDeleteProjectMediaFolder,
  onDeleteProjectMediaFolders,
  onDeleteSequence,
  onDeleteSequences,
  onDuplicateSequence,
  onImportMedia,
  onImportLocalMediaFiles,
  onInspectProjectAsset,
  onInspectSequence,
  onInsertGeneratedClip,
  onInsertProjectAsset,
  onMoveGeneratedClipToFolder,
  onMoveProjectAssetToFolder,
  onNewFolder,
  onNewSequence,
  onRenameProjectMediaFolder,
  onSelectSequence,
  onClearProjectMediaInspector,
}: TimelineProjectSidebarProps) {
  const [folderDialog, setFolderDialog] = useState<ProjectMediaFolderDialogState | null>(null);
  const projectMedia = useProjectMediaController({
    nodes,
    projectAssets,
    projectMediaFolders,
    sequences,
    studioCanvasNodeCopy,
    onClearProjectMediaInspector,
    onDeleteGeneratedClip,
    onDeleteGeneratedClips,
    onDeleteProjectAsset,
    onDeleteProjectAssets,
    onDeleteProjectMediaFolder,
    onDeleteProjectMediaFolders,
    onDeleteSequence,
    onDeleteSequences,
    onDuplicateSequence,
    onImportMedia,
    onImportLocalMediaFiles,
    onInspectProjectAsset: (assetId) => onInspectProjectAsset(assetId),
    onInspectSequence,
    onInsertGeneratedClip,
    onInsertProjectAsset,
    onMoveGeneratedClipToFolder,
    onMoveProjectAssetToFolder,
    onRenameProjectMediaFolder,
    onSelectSequence,
  });
  const folderById = useMemo(
    () => new Map(projectMediaFolders.map((folder) => [folder.id, folder])),
    [projectMediaFolders]
  );
  const assetById = useMemo(
    () => new Map(projectAssets.map((asset) => [asset.id, asset])),
    [projectAssets]
  );
  const generatedNodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  );
  const mediaKindFilterOptions: Array<{ label: string; value: ProjectMediaKindFilter }> = [
    { label: copy.mediaKindAll, value: 'all' },
    { label: copy.mediaKindImage, value: 'image' },
    { label: copy.mediaKindVideo, value: 'video' },
    { label: copy.mediaKindAudio, value: 'audio' },
  ];
  const isContextMenuOpen = (type: ProjectMediaContextMenu['type'], id: string) => (
    projectMedia.contextMenu?.type === type && projectMedia.contextMenu.id === id
  );

  const openCreateFolderDialog = () => {
    setFolderDialog({
      initialName: formatCopyValue(copy.newFolderDefaultName, { index: projectMediaFolders.length + 1 }),
      type: 'create',
    });
  };

  const openRenameFolderDialog = (menu: ProjectMediaContextMenu) => {
    const folder = folderById.get(menu.id);
    if (menu.type !== 'folder' || !folder) return;
    setFolderDialog({
      folderId: folder.id,
      initialName: folder.name,
      type: 'rename',
    });
  };

  const openMoveMediaDialog = (menu: ProjectMediaContextMenu) => {
    if (menu.type === 'asset') {
      const asset = assetById.get(menu.id);
      if (!asset) return;
      setFolderDialog({
        currentFolderId: asset.folderId ?? null,
        itemId: asset.id,
        itemType: 'asset',
        title: asset.filename,
        type: 'move',
      });
      return;
    }

    if (menu.type === 'generated') {
      const node = generatedNodeById.get(menu.id);
      if (!node?.data.output) return;
      setFolderDialog({
        currentFolderId: node.data.output.projectMediaFolderId ?? null,
        itemId: node.id,
        itemType: 'generated',
        title: node.data.title,
        type: 'move',
      });
    }
  };

  return (
    <aside className={`${styles.librarySidebar} ${styles.timelineProjectSidebar}`} aria-label={copy.sidebarLabel}>
      <div className={styles.projectMediaHeader}>
        <div className={styles.projectMediaHeaderCopy}>
          <p className={styles.projectMediaTitle}>{copy.title}</p>
          <span className={styles.projectMediaSubtitle}>{copy.subtitle}</span>
        </div>
        <button type="button" className={styles.projectMediaActionButton} onClick={projectMedia.importMedia}>
          <Upload size={16} />
          {copy.importMedia}
        </button>
      </div>
      <div className={styles.projectMediaControls}>
        <label className={styles.projectMediaSearch}>
          <Search size={14} />
          <span>{copy.searchLabel}</span>
          <input
            type="search"
            value={projectMedia.searchQuery}
            onChange={(event) => projectMedia.setSearchQuery(event.currentTarget.value)}
            placeholder={copy.searchPlaceholder}
          />
        </label>
      </div>
      <StudioSegmentedControl<ProjectMediaKindFilter>
        className={styles.projectMediaKindFilters}
        buttonClassName={styles.projectMediaKindFilterButton}
        activeButtonClassName={styles.projectMediaKindFilterButtonActive}
        label={copy.mediaKindFilters}
        value={projectMedia.mediaKindFilter}
        onChange={projectMedia.setMediaKindFilter}
        options={mediaKindFilterOptions}
      />
      {projectMedia.activeFolder ? (
        <div className={styles.projectMediaFolderHeader}>
          <button type="button" className={styles.projectMediaBackButton} onClick={projectMedia.openRootFolder}>
            <ArrowLeft size={14} />
            {copy.backToProjectMedia}
          </button>
          <div className={styles.projectMediaFolderTitle}>
            <FolderOpen size={15} />
            <strong>{localizeStudioGeneratedFolderDisplayName(projectMedia.activeFolder.name, copy)}</strong>
          </div>
        </div>
      ) : null}

      <div
        className={styles.projectMediaGrid}
        data-project-media-grid="true"
        aria-label={formatCopyValue(copy.projectMediaGrid, { project: projectName })}
        onDragOver={projectMedia.handleProjectMediaDragOver}
        onDrop={projectMedia.handleProjectMediaDrop}
      >
        {projectMedia.visibleSequences.map((sequence) => {
          const sequenceTitle = localizeStudioGeneratedSequenceDisplayName(sequence.name, copy);
          const sequenceKey = projectMediaSelectionKey('sequence', sequence.id);
          const isSelectionSelected = projectMedia.selectedKeySet.has(sequenceKey);
          return (
            <ProjectMediaCard
              key={sequence.id}
              ariaPressed={sequence.isActive}
              dataProjectSequenceId={sequence.id}
              copy={copy}
              id={sequenceKey}
              isSelected={isSelectionSelected || sequence.isActive}
              isSelectionSelected={isSelectionSelected}
              kind="sequence"
              contextMenuOpen={isContextMenuOpen('sequence', sequence.id)}
              contextMenuToken={`sequence:${sequence.id}`}
              onClick={(event) => projectMedia.selectSequence(sequence.id, event)}
              onContextMenu={(event) => projectMedia.openContextMenu(event, { id: sequence.id, title: sequenceTitle, type: 'sequence' })}
              subtitle={`${formatProjectMediaDuration(sequence.durationSec)}${MEDIA_DETAIL_SEPARATOR}${sequence.clipCount} ${sequence.clipCount === 1 ? copy.clipSingular : copy.clipPlural}${MEDIA_DETAIL_SEPARATOR}${sequence.settings.aspectRatio}`}
              thumbnailUrl={sequence.previewUrl}
              title={sequenceTitle}
            />
          );
        })}

        {projectMedia.visibleFolders.map(({ folder, itemCount, key }) => {
          const folderTitle = localizeStudioGeneratedFolderDisplayName(folder.name, copy);
          const folderSubtitle = `${itemCount} ${itemCount === 1 ? copy.itemSingular : copy.itemPlural}`;
          return (
            <div
              key={folder.id}
              data-project-media-folder-id={folder.id}
              data-project-media-folder-drop-target={projectMedia.folderDropTargetId === folder.id ? 'true' : undefined}
            >
              <ProjectMediaCard
                copy={copy}
                id={key}
                isSelected={projectMedia.selectedKeySet.has(key) || projectMedia.folderDropTargetId === folder.id}
                isSelectionSelected={projectMedia.selectedKeySet.has(key)}
                kind="folder"
                contextMenuOpen={isContextMenuOpen('folder', folder.id)}
                contextMenuToken={`folder:${folder.id}`}
                onClick={(event) => projectMedia.selectProjectMediaFolder(folder.id, event)}
                onContextMenu={(event) => projectMedia.openContextMenu(event, { id: folder.id, title: folderTitle, type: 'folder' })}
                onDragLeave={(event) => projectMedia.handleFolderDragLeave(event, folder.id)}
                onDragOver={(event) => projectMedia.handleFolderDragOver(event, folder.id)}
                onDrop={(event) => projectMedia.handleFolderDrop(event, folder.id)}
                subtitle={folderSubtitle}
                title={folderTitle}
              />
            </div>
          );
        })}

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
                copy={copy}
                canDrag={Boolean(mediaKind)}
                dragKind={mediaKind ?? undefined}
                id={key}
                isSelected={projectMedia.selectedKeySet.has(key)}
                kind={cardKind}
                contextMenuOpen={isContextMenuOpen('asset', asset.id)}
                contextMenuToken={`asset:${asset.id}`}
                onClick={(event) => projectMedia.selectProjectAsset(asset.id, event)}
                onContextMenu={(event) => projectMedia.openContextMenu(event, { id: asset.id, title: asset.filename, type: 'asset' })}
                onDragEnd={projectMedia.endProjectMediaTimelineDrag}
                onDragStart={mediaKind ? (event) => projectMedia.beginProjectAssetTimelineDrag(event, asset) : undefined}
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
                copy={copy}
                canDrag={Boolean(mediaKind)}
                dragKind={mediaKind ?? undefined}
                id={key}
                isSelected={projectMedia.selectedKeySet.has(key)}
                kind="generated"
                contextMenuOpen={isContextMenuOpen('generated', node.id)}
                contextMenuToken={`generated:${node.id}`}
                onClick={(event) => projectMedia.selectGeneratedNode(node.id, event)}
                onContextMenu={(event) => projectMedia.openContextMenu(event, { id: node.id, title: node.data.title, type: 'generated' })}
                onDragEnd={projectMedia.endProjectMediaTimelineDrag}
                onDragStart={mediaKind ? (event) => projectMedia.beginGeneratedNodeTimelineDrag(event, node) : undefined}
                subtitle={subtitle}
                thumbnailUrl={thumbnailUrl}
                title={node.data.title}
              />
            </div>
          );
        })}

        {!projectMedia.totalItems || (!projectMedia.visibleSequences.length && !projectMedia.visibleFolders.length && !projectMedia.visibleProjectAssets.length && !projectMedia.visibleGeneratedNodes.length) ? (
          <p className={styles.projectMediaEmpty}>
            {projectMedia.totalItems ? (projectMedia.activeFolder ? copy.folderEmpty : copy.noSearchMatches) : copy.empty}
          </p>
        ) : null}
      </div>

      <div className={styles.projectMediaFooterBar}>
        <div className={styles.projectMediaItemCount}>
          <Layers3 size={16} />
          <span>{projectMedia.visibleItemCount} {projectMedia.visibleItemCount === 1 ? copy.itemSingular : copy.itemPlural}</span>
        </div>
        <div className={styles.projectMediaFooterActions}>
          <ProjectMediaFooterAction onClick={openCreateFolderDialog}>
            <FolderPlus size={15} />
            {copy.newFolder}
          </ProjectMediaFooterAction>
          <ProjectMediaFooterAction dataProjectSequenceCreate onClick={onNewSequence}>
            <FileVideo2 size={15} />
            {copy.newSequence}
          </ProjectMediaFooterAction>
          <ProjectMediaFooterAction danger disabled={!projectMedia.selectedCanDelete} onClick={projectMedia.deleteSelected}>
            <Trash2 size={15} />
            {copy.delete}
          </ProjectMediaFooterAction>
        </div>
      </div>

      <ProjectMediaContextMenu
        copy={copy}
        canMoveMediaToFolder={projectMedia.canMoveMediaToFolder}
        menu={projectMedia.contextMenu}
        onClose={() => projectMedia.setContextMenu(null)}
        onDelete={projectMedia.deleteMenuItem}
        onDuplicate={projectMedia.duplicateMenuItem}
        onInsert={projectMedia.insertMenuItem}
        onMove={openMoveMediaDialog}
        onRename={openRenameFolderDialog}
      />
      <ProjectMediaFolderDialog
        copy={copy}
        dialog={folderDialog}
        folders={projectMediaFolders}
        onClose={() => setFolderDialog(null)}
        onCreateFolder={onNewFolder}
        onMoveMedia={(dialog, folderId) => {
          if (dialog.itemType === 'asset') onMoveProjectAssetToFolder(dialog.itemId, folderId);
          else onMoveGeneratedClipToFolder(dialog.itemId, folderId);
        }}
        onRenameFolder={onRenameProjectMediaFolder}
      />
    </aside>
  );
}
