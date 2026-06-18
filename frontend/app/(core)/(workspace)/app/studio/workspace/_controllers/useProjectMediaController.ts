'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphNode,
  WorkspaceProjectMediaFolder,
  WorkspaceProjectSettings,
} from '../_lib/workspace-types';
import {
  applyProjectMediaItemDragPayload,
  applyProjectMediaTimelineDragPayload,
  clearProjectMediaItemDragPayload,
  parseProjectMediaItemDragPayload,
  projectMediaItemDragPayloadForAsset,
  projectMediaItemDragPayloadForGeneratedNode,
  projectMediaAssetThumbnailUrl,
  projectMediaGeneratedThumbnailUrl,
  projectMediaTimelineDragPayloadForAsset,
  projectMediaTimelineDragPayloadForGeneratedNode,
  projectMediaTimelineKindForAsset,
  projectMediaTimelineKindForGeneratedNode,
} from '../_lib/workspace-project-media-drag';
import {
  deriveWorkspaceMediaDimensions,
  parseWorkspaceMediaDimensions,
} from '../_lib/workspace-clip-composition';
import { clearTimelineNodeDragPayload } from '../_lib/timeline/timeline-external-drop';
import type { StudioCopy } from '../../_lib/studio-copy';

const MEDIA_DETAIL_SEPARATOR = ' • ';

export type ProjectMediaSelection =
  | { id: string; type: 'asset' | 'folder' | 'generated' | 'sequence' }
  | null;
export type ProjectMediaSelectionItem = NonNullable<ProjectMediaSelection>;
export type ProjectMediaKindFilter = 'all' | 'audio' | 'image' | 'video';
export type ProjectMediaSelectionGesture = {
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
};

export type ProjectMediaContextMenu = {
  id: string;
  title: string;
  type: 'asset' | 'folder' | 'generated' | 'sequence';
  x: number;
  y: number;
};

export type WorkspaceProjectSequenceSummary = {
  id: string;
  name: string;
  durationSec: number;
  clipCount: number;
  settings: WorkspaceProjectSettings;
  isActive: boolean;
  previewUrl?: string | null;
};

export type ProjectMediaAssetView = {
  asset: WorkspaceAssetRecord;
  cardKind: 'audio' | 'image' | 'video';
  key: string;
  mediaKind: 'audio' | 'image' | 'video' | null;
  subtitle: string;
  thumbnailUrl: string | null;
  timelineDurationSec: number;
};

export type ProjectMediaFolderView = {
  folder: WorkspaceProjectMediaFolder;
  itemCount: number;
  key: string;
  subtitle: string;
};

export type ProjectMediaGeneratedView = {
  key: string;
  mediaKind: 'audio' | 'image' | 'video' | null;
  node: WorkspaceGraphNode;
  subtitle: string;
  thumbnailUrl: string | null;
  timelineDurationSec?: number;
};

type UseProjectMediaControllerArgs = {
  nodes: WorkspaceGraphNode[];
  projectAssets: WorkspaceAssetRecord[];
  projectMediaFolders: WorkspaceProjectMediaFolder[];
  sequences: WorkspaceProjectSequenceSummary[];
  studioCanvasNodeCopy: StudioCopy['canvas']['nodes'];
  onClearProjectMediaInspector: () => void;
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
  onRenameProjectMediaFolder: (folderId: string, requestedName: string) => void;
  onSelectSequence: (sequenceId: string) => void;
};

export function formatProjectMediaDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const totalSeconds = Math.ceil(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function projectMediaSelectionKey(type: NonNullable<ProjectMediaSelection>['type'], id: string): string {
  return `${type}:${id}`;
}

function projectMediaSelectionItemKey(item: ProjectMediaSelectionItem): string {
  return projectMediaSelectionKey(item.type, item.id);
}

function isProjectMediaMultiSelectionGesture(gesture?: ProjectMediaSelectionGesture): boolean {
  return Boolean(gesture?.ctrlKey || gesture?.metaKey || gesture?.shiftKey);
}

function generatedClipNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
  return nodes.filter((node) => node.data.kind === 'output' && Boolean(node.data.output));
}

function mediaCardKindForAsset(asset: WorkspaceAssetRecord): 'audio' | 'image' | 'video' {
  if (asset.kind === 'audio') return 'audio';
  if (asset.kind === 'video') return 'video';
  return 'image';
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
}

function aspectRatioLabelFromDimensions(value?: string): string | null {
  const dimensions = parseWorkspaceMediaDimensions(value);
  if (!dimensions) return null;
  const divisor = greatestCommonDivisor(dimensions.width, dimensions.height);
  return `${dimensions.width / divisor}:${dimensions.height / divisor}`;
}

export function mediaSubtitleForAsset(asset: WorkspaceAssetRecord): string {
  if (asset.kind === 'audio') {
    return [asset.durationSec ? formatProjectMediaDuration(asset.durationSec) : null].filter(Boolean).join(MEDIA_DETAIL_SEPARATOR);
  }
  if (asset.kind === 'video') {
    return [
      asset.durationSec ? formatProjectMediaDuration(asset.durationSec) : null,
      asset.dimensions,
      aspectRatioLabelFromDimensions(asset.dimensions),
    ].filter(Boolean).join(MEDIA_DETAIL_SEPARATOR);
  }
  return asset.dimensions ?? asset.subtitle;
}

export function mediaSubtitleForGeneratedNode(node: WorkspaceGraphNode): string {
  const output = node.data.output;
  if (!output) return node.data.subtitle ?? 'Generated clip';
  const dimensions = output.kind === 'audio'
    ? null
    : deriveWorkspaceMediaDimensions({
        aspectRatio: output.aspectRatio,
        resolution: output.resolution,
      });
  const dimensionsLabel = dimensions ? `${dimensions.width}x${dimensions.height}` : null;
  return [
    output.durationSec ? formatProjectMediaDuration(output.durationSec) : null,
    dimensionsLabel,
    output.aspectRatio,
    output.modelLabel,
  ].filter(Boolean).join(MEDIA_DETAIL_SEPARATOR);
}

function generatedNodeFolderId(node: WorkspaceGraphNode, folderIds: Set<string>): string | null {
  const folderId = node.data.output?.projectMediaFolderId;
  return folderId && folderIds.has(folderId) ? folderId : null;
}

function beginProjectAssetTimelineDrag(
  event: ReactDragEvent<HTMLElement>,
  asset: WorkspaceAssetRecord,
  studioCanvasNodeCopy: StudioCopy['canvas']['nodes']
): void {
  const payload = projectMediaTimelineDragPayloadForAsset(asset);
  if (!payload) return;
  applyProjectMediaItemDragPayload(event.dataTransfer, projectMediaItemDragPayloadForAsset(asset));
  applyProjectMediaTimelineDragPayload(event.dataTransfer, payload, studioCanvasNodeCopy);
}

function beginGeneratedNodeTimelineDrag(
  event: ReactDragEvent<HTMLElement>,
  node: WorkspaceGraphNode,
  studioCanvasNodeCopy: StudioCopy['canvas']['nodes']
): void {
  const payload = projectMediaTimelineDragPayloadForGeneratedNode(node);
  if (!payload) return;
  const itemPayload = projectMediaItemDragPayloadForGeneratedNode(node);
  if (itemPayload) applyProjectMediaItemDragPayload(event.dataTransfer, itemPayload);
  applyProjectMediaTimelineDragPayload(event.dataTransfer, payload, studioCanvasNodeCopy);
}

function endProjectMediaTimelineDrag(): void {
  clearProjectMediaItemDragPayload();
  clearTimelineNodeDragPayload();
}

function hasLocalFileDrag(dataTransfer: DataTransfer): boolean {
  return dataTransfer.files.length > 0 || Array.from(dataTransfer.types).includes('Files');
}

function localFilesFromDataTransfer(dataTransfer: DataTransfer): File[] {
  return Array.from(dataTransfer.files).filter((file) => Boolean(file.name || file.size || file.type));
}

export function useProjectMediaController({
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
  onInspectProjectAsset,
  onInspectSequence,
  onInsertGeneratedClip,
  onInsertProjectAsset,
  onMoveGeneratedClipToFolder,
  onMoveProjectAssetToFolder,
  onRenameProjectMediaFolder,
  onSelectSequence,
}: UseProjectMediaControllerArgs) {
  const generatedNodes = useMemo(() => generatedClipNodes(nodes), [nodes]);
  const [selectedMediaItems, setSelectedMediaItems] = useState<ProjectMediaSelectionItem[]>([]);
  const [selectionAnchorKey, setSelectionAnchorKey] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ProjectMediaContextMenu | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderDropTargetId, setFolderDropTargetId] = useState<string | null>(null);
  const [mediaKindFilter, setMediaKindFilter] = useState<ProjectMediaKindFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const folderIds = useMemo(() => new Set(projectMediaFolders.map((folder) => folder.id)), [projectMediaFolders]);
  const folderItemCounts = useMemo(() => {
    const counts = new Map(projectMediaFolders.map((folder) => [folder.id, 0]));
    projectAssets.forEach((asset) => {
      if (asset.folderId && counts.has(asset.folderId)) {
        counts.set(asset.folderId, (counts.get(asset.folderId) ?? 0) + 1);
      }
    });
    generatedNodes.forEach((node) => {
      const folderId = generatedNodeFolderId(node, folderIds);
      if (folderId && counts.has(folderId)) {
        counts.set(folderId, (counts.get(folderId) ?? 0) + 1);
      }
    });
    return counts;
  }, [folderIds, generatedNodes, projectAssets, projectMediaFolders]);
  const activeFolder = useMemo(
    () => projectMediaFolders.find((folder) => folder.id === activeFolderId) ?? null,
    [activeFolderId, projectMediaFolders]
  );
  const canMoveMediaToFolder = projectMediaFolders.length > 0;
  const totalItems = sequences.length + projectMediaFolders.length + projectAssets.length + generatedNodes.length;
  const selectedKey = selectedMediaItems.length === 1 ? projectMediaSelectionItemKey(selectedMediaItems[0]) : null;
  const selectedKeySet = useMemo(
    () => new Set(selectedMediaItems.map((item) => projectMediaSelectionItemKey(item))),
    [selectedMediaItems]
  );
  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();

  const matchesSearch = useMemo(() => {
    return (title: string, subtitle: string, kind: string) => {
      if (!normalizedSearchQuery) return true;
      return `${title} ${subtitle} ${kind}`.toLowerCase().includes(normalizedSearchQuery);
    };
  }, [normalizedSearchQuery]);
  const matchesMediaKindFilter = useCallback((kind: ProjectMediaKindFilter | null) => {
    return mediaKindFilter === 'all' || kind === mediaKindFilter;
  }, [mediaKindFilter]);

  const visibleSequences = useMemo(
    () => activeFolderId || mediaKindFilter !== 'all' ? [] : sequences.filter((sequence) => matchesSearch(
      sequence.name,
      `${formatProjectMediaDuration(sequence.durationSec)} ${sequence.clipCount} clips ${sequence.settings.aspectRatio}`,
      'sequence'
    )),
    [activeFolderId, matchesSearch, mediaKindFilter, sequences]
  );

  const visibleProjectAssets = useMemo<ProjectMediaAssetView[]>(
    () => {
      const views: ProjectMediaAssetView[] = [];
      for (const asset of projectAssets) {
        if ((asset.folderId ?? null) !== activeFolderId) continue;
        const timelineKind = projectMediaTimelineKindForAsset(asset);
        if (!matchesMediaKindFilter(timelineKind)) continue;
        const subtitle = mediaSubtitleForAsset(asset);
        if (!matchesSearch(asset.filename, subtitle, asset.kind)) continue;
        const payload = projectMediaTimelineDragPayloadForAsset(asset);
        views.push({
          asset,
          cardKind: mediaCardKindForAsset(asset),
          key: projectMediaSelectionKey('asset', asset.id),
          mediaKind: payload?.mediaKind ?? timelineKind,
          subtitle,
          thumbnailUrl: projectMediaAssetThumbnailUrl(asset),
          timelineDurationSec: payload?.durationSec ?? 0,
        });
      }
      return views;
    },
    [activeFolderId, matchesMediaKindFilter, matchesSearch, projectAssets]
  );

  const visibleFolders = useMemo<ProjectMediaFolderView[]>(
    () => activeFolderId || mediaKindFilter !== 'all' ? [] : projectMediaFolders
      .filter((folder) => matchesSearch(folder.name, 'Folder', 'folder'))
      .map((folder) => {
        const itemCount = folderItemCounts.get(folder.id) ?? 0;
        return {
          folder,
          itemCount,
          key: projectMediaSelectionKey('folder', folder.id),
          subtitle: `${itemCount} item${itemCount === 1 ? '' : 's'}`,
        };
      }),
    [activeFolderId, folderItemCounts, matchesSearch, mediaKindFilter, projectMediaFolders]
  );

  const visibleGeneratedNodes = useMemo<ProjectMediaGeneratedView[]>(
    () => {
      const views: ProjectMediaGeneratedView[] = [];
      for (const node of generatedNodes) {
        if (generatedNodeFolderId(node, folderIds) !== activeFolderId) continue;
        const timelineKind = projectMediaTimelineKindForGeneratedNode(node);
        if (!matchesMediaKindFilter(timelineKind)) continue;
        const subtitle = mediaSubtitleForGeneratedNode(node);
        if (!matchesSearch(node.data.title, subtitle, 'generated')) continue;
        const payload = projectMediaTimelineDragPayloadForGeneratedNode(node);
        views.push({
          key: projectMediaSelectionKey('generated', node.id),
          mediaKind: payload?.mediaKind ?? timelineKind,
          node,
          subtitle,
          thumbnailUrl: projectMediaGeneratedThumbnailUrl(node),
          timelineDurationSec: payload?.durationSec,
        });
      }
      return views;
    },
    [activeFolderId, folderIds, generatedNodes, matchesMediaKindFilter, matchesSearch]
  );
  const visibleItemCount = visibleSequences.length + visibleFolders.length + visibleProjectAssets.length + visibleGeneratedNodes.length;
  const visibleSelectionItems = useMemo(
    () => [
      ...visibleSequences.map((sequence) => ({
        id: sequence.id,
        key: projectMediaSelectionKey('sequence', sequence.id),
        type: 'sequence' as const,
      })),
      ...visibleFolders.map(({ folder, key }) => ({
        id: folder.id,
        key,
        type: 'folder' as const,
      })),
      ...visibleProjectAssets.map(({ asset, key }) => ({
        id: asset.id,
        key,
        type: 'asset' as const,
      })),
      ...visibleGeneratedNodes.map(({ key, node }) => ({
        id: node.id,
        key,
        type: 'generated' as const,
      })),
    ],
    [visibleFolders, visibleGeneratedNodes, visibleProjectAssets, visibleSequences]
  );
  const existingSelectionKeys = useMemo(() => new Set([
    ...sequences.map((sequence) => projectMediaSelectionKey('sequence', sequence.id)),
    ...projectMediaFolders.map((folder) => projectMediaSelectionKey('folder', folder.id)),
    ...projectAssets.map((asset) => projectMediaSelectionKey('asset', asset.id)),
    ...generatedNodes.map((node) => projectMediaSelectionKey('generated', node.id)),
  ]), [generatedNodes, projectAssets, projectMediaFolders, sequences]);
  const selectedSequenceIds = selectedMediaItems
    .filter((item) => item.type === 'sequence')
    .map((item) => item.id);
  const canDeleteSelectedSequences = selectedSequenceIds.length > 0 && sequences.length - selectedSequenceIds.length >= 1;
  const deletableSelectedMediaItems = useMemo(
    () => selectedMediaItems.filter((item) => item.type !== 'sequence' || canDeleteSelectedSequences),
    [canDeleteSelectedSequences, selectedMediaItems]
  );
  const selectedCanDelete = deletableSelectedMediaItems.length > 0;

  const selectProjectMediaItem = useCallback((item: ProjectMediaSelectionItem, gesture?: ProjectMediaSelectionGesture) => {
    const itemKey = projectMediaSelectionItemKey(item);
    setSelectedMediaItems((current) => {
      const shouldRangeSelect = Boolean(gesture?.shiftKey && selectionAnchorKey);
      if (shouldRangeSelect) {
        const anchorIndex = visibleSelectionItems.findIndex((candidate) => candidate.key === selectionAnchorKey);
        const itemIndex = visibleSelectionItems.findIndex((candidate) => candidate.key === itemKey);
        if (anchorIndex !== -1 && itemIndex !== -1) {
          const startIndex = Math.min(anchorIndex, itemIndex);
          const endIndex = Math.max(anchorIndex, itemIndex);
          return visibleSelectionItems
            .slice(startIndex, endIndex + 1)
            .map(({ id, type }) => ({ id, type }));
        }
      }

      if (gesture?.ctrlKey || gesture?.metaKey) {
        const isAlreadySelected = current.some((candidate) => projectMediaSelectionItemKey(candidate) === itemKey);
        if (isAlreadySelected) {
          return current.filter((candidate) => projectMediaSelectionItemKey(candidate) !== itemKey);
        }
        return [...current, item];
      }

      return [item];
    });
    setSelectionAnchorKey(itemKey);
  }, [selectionAnchorKey, visibleSelectionItems]);

  const openContextMenu = useCallback((event: ReactMouseEvent<HTMLElement>, menu: Omit<ProjectMediaContextMenu, 'x' | 'y'>) => {
    event.preventDefault();
    event.stopPropagation();
    const menuSelection = { id: menu.id, type: menu.type };
    const menuSelectionKey = projectMediaSelectionItemKey(menuSelection);
    setSelectedMediaItems((current) => {
      if (current.some((item) => projectMediaSelectionItemKey(item) === menuSelectionKey)) return current;
      return [menuSelection];
    });
    setSelectionAnchorKey(menuSelectionKey);
    setContextMenu({
      ...menu,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const selectSequence = useCallback((sequenceId: string, gesture?: ProjectMediaSelectionGesture) => {
    selectProjectMediaItem({ id: sequenceId, type: 'sequence' }, gesture);
    if (isProjectMediaMultiSelectionGesture(gesture)) return;
    onInspectSequence(sequenceId);
    onSelectSequence(sequenceId);
  }, [onInspectSequence, onSelectSequence, selectProjectMediaItem]);

  const selectProjectAsset = useCallback((assetId: string, gesture?: ProjectMediaSelectionGesture) => {
    selectProjectMediaItem({ id: assetId, type: 'asset' }, gesture);
    if (isProjectMediaMultiSelectionGesture(gesture)) {
      onClearProjectMediaInspector();
      return;
    }
    onInspectProjectAsset(assetId);
  }, [onClearProjectMediaInspector, onInspectProjectAsset, selectProjectMediaItem]);

  const selectProjectMediaFolder = useCallback((folderId: string, gesture?: ProjectMediaSelectionGesture) => {
    selectProjectMediaItem({ id: folderId, type: 'folder' }, gesture);
    if (isProjectMediaMultiSelectionGesture(gesture)) {
      onClearProjectMediaInspector();
      return;
    }
    setActiveFolderId(folderId);
    setSearchQuery('');
    onClearProjectMediaInspector();
  }, [onClearProjectMediaInspector, selectProjectMediaItem]);

  const selectGeneratedNode = useCallback((nodeId: string, gesture?: ProjectMediaSelectionGesture) => {
    selectProjectMediaItem({ id: nodeId, type: 'generated' }, gesture);
    onClearProjectMediaInspector();
  }, [onClearProjectMediaInspector, selectProjectMediaItem]);

  const insertMenuItem = useCallback((menu: ProjectMediaContextMenu) => {
    if (menu.type === 'asset') onInsertProjectAsset(menu.id);
    else if (menu.type === 'generated') onInsertGeneratedClip(menu.id);
    else if (menu.type === 'folder') selectProjectMediaFolder(menu.id);
    else selectSequence(menu.id);
  }, [onInsertGeneratedClip, onInsertProjectAsset, selectProjectMediaFolder, selectSequence]);

  const deleteMenuItem = useCallback((menu: ProjectMediaContextMenu) => {
    if (menu.type === 'asset') onDeleteProjectAsset(menu.id);
    else if (menu.type === 'folder') onDeleteProjectMediaFolder(menu.id);
    else if (menu.type === 'generated') onDeleteGeneratedClip(menu.id);
    else onDeleteSequence(menu.id);
    const menuKey = projectMediaSelectionKey(menu.type, menu.id);
    setSelectedMediaItems((current) => current.filter((item) => projectMediaSelectionItemKey(item) !== menuKey));
    setSelectionAnchorKey((current) => (current === menuKey ? null : current));
  }, [onDeleteGeneratedClip, onDeleteProjectAsset, onDeleteProjectMediaFolder, onDeleteSequence]);

  const moveMenuItem = useCallback((menu: ProjectMediaContextMenu, folderId: string | null) => {
    if (menu.type === 'asset') onMoveProjectAssetToFolder(menu.id, folderId);
    if (menu.type === 'generated') onMoveGeneratedClipToFolder(menu.id, folderId);
  }, [onMoveGeneratedClipToFolder, onMoveProjectAssetToFolder]);

  const renameMenuItem = useCallback((menu: ProjectMediaContextMenu, requestedName: string) => {
    if (menu.type !== 'folder') return;
    onRenameProjectMediaFolder(menu.id, requestedName);
  }, [onRenameProjectMediaFolder]);

  const duplicateMenuItem = useCallback((menu: ProjectMediaContextMenu) => {
    if (menu.type !== 'sequence') return;
    onDuplicateSequence(menu.id);
    setSelectedMediaItems([]);
    setSelectionAnchorKey(null);
  }, [onDuplicateSequence]);

  const deleteSelected = useCallback(() => {
    if (!selectedCanDelete) return;
    const assetIds = deletableSelectedMediaItems
      .filter((item) => item.type === 'asset')
      .map((item) => item.id);
    const folderIds = deletableSelectedMediaItems
      .filter((item) => item.type === 'folder')
      .map((item) => item.id);
    const generatedIds = deletableSelectedMediaItems
      .filter((item) => item.type === 'generated')
      .map((item) => item.id);
    const sequenceIds = deletableSelectedMediaItems
      .filter((item) => item.type === 'sequence')
      .map((item) => item.id);

    if (assetIds.length === 1) onDeleteProjectAsset(assetIds[0]);
    if (assetIds.length > 1) onDeleteProjectAssets(assetIds);
    if (folderIds.length === 1) onDeleteProjectMediaFolder(folderIds[0]);
    if (folderIds.length > 1) onDeleteProjectMediaFolders(folderIds);
    if (generatedIds.length === 1) onDeleteGeneratedClip(generatedIds[0]);
    if (generatedIds.length > 1) onDeleteGeneratedClips(generatedIds);
    if (sequenceIds.length === 1) onDeleteSequence(sequenceIds[0]);
    if (sequenceIds.length > 1) onDeleteSequences(sequenceIds);
    setSelectedMediaItems([]);
    setSelectionAnchorKey(null);
  }, [deletableSelectedMediaItems, onDeleteGeneratedClip, onDeleteGeneratedClips, onDeleteProjectAsset, onDeleteProjectAssets, onDeleteProjectMediaFolder, onDeleteProjectMediaFolders, onDeleteSequence, onDeleteSequences, selectedCanDelete]);

  const openRootFolder = useCallback(() => {
    setActiveFolderId(null);
    setSelectedMediaItems([]);
    setSelectionAnchorKey(null);
    setSearchQuery('');
    onClearProjectMediaInspector();
  }, [onClearProjectMediaInspector]);

  const setProjectMediaKindFilter = useCallback((filter: ProjectMediaKindFilter) => {
    setMediaKindFilter(filter);
    setSelectedMediaItems([]);
    setSelectionAnchorKey(null);
    onClearProjectMediaInspector();
  }, [onClearProjectMediaInspector]);

  const importMedia = useCallback(() => {
    onImportMedia(activeFolderId);
  }, [activeFolderId, onImportMedia]);

  const handleLocalFileDragOver = useCallback((event: ReactDragEvent<HTMLElement>, folderId?: string | null) => {
    if (!hasLocalFileDrag(event.dataTransfer)) return false;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setFolderDropTargetId(folderId ?? null);
    return true;
  }, []);

  const handleLocalFileDrop = useCallback((event: ReactDragEvent<HTMLElement>, folderId?: string | null) => {
    if (!hasLocalFileDrag(event.dataTransfer)) return false;
    const files = localFilesFromDataTransfer(event.dataTransfer);
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setFolderDropTargetId(null);
    if (files.length) {
      void onImportLocalMediaFiles(files, folderId ?? null);
    }
    return true;
  }, [onImportLocalMediaFiles]);

  const handleProjectMediaDragOver = useCallback((event: ReactDragEvent<HTMLElement>) => {
    handleLocalFileDragOver(event, null);
  }, [handleLocalFileDragOver]);

  const handleProjectMediaDrop = useCallback((event: ReactDragEvent<HTMLElement>) => {
    handleLocalFileDrop(event, activeFolderId);
  }, [activeFolderId, handleLocalFileDrop]);

  const moveDraggedMediaToFolder = useCallback((payload: ReturnType<typeof parseProjectMediaItemDragPayload>, folderId: string) => {
    if (!payload || payload.sourceFolderId === folderId) return false;
    if (payload.itemType === 'asset') onMoveProjectAssetToFolder(payload.itemId, folderId);
    else onMoveGeneratedClipToFolder(payload.itemId, folderId);
    setSelectedMediaItems([{ id: payload.itemId, type: payload.itemType }]);
    setSelectionAnchorKey(projectMediaSelectionKey(payload.itemType, payload.itemId));
    return true;
  }, [onMoveGeneratedClipToFolder, onMoveProjectAssetToFolder]);

  const handleFolderDragOver = useCallback((event: ReactDragEvent<HTMLElement>, folderId: string) => {
    if (handleLocalFileDragOver(event, folderId)) return;
    const payload = parseProjectMediaItemDragPayload(event.dataTransfer);
    if (!payload || payload.sourceFolderId === folderId) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setFolderDropTargetId(folderId);
  }, [handleLocalFileDragOver]);

  const handleFolderDragLeave = useCallback((event: ReactDragEvent<HTMLElement>, folderId: string) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setFolderDropTargetId((current) => current === folderId ? null : current);
  }, []);

  const handleFolderDrop = useCallback((event: ReactDragEvent<HTMLElement>, folderId: string) => {
    if (handleLocalFileDrop(event, folderId)) return;
    const payload = parseProjectMediaItemDragPayload(event.dataTransfer);
    setFolderDropTargetId(null);
    clearProjectMediaItemDragPayload();
    if (!payload) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    moveDraggedMediaToFolder(payload, folderId);
  }, [handleLocalFileDrop, moveDraggedMediaToFolder]);

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

  useEffect(() => {
    if (!activeFolderId || folderIds.has(activeFolderId)) return;
    setActiveFolderId(null);
    setSelectedMediaItems([]);
    setSelectionAnchorKey(null);
  }, [activeFolderId, folderIds]);

  useEffect(() => {
    setSelectedMediaItems((current) => current.filter((item) => existingSelectionKeys.has(projectMediaSelectionItemKey(item))));
    setSelectionAnchorKey((current) => (current && existingSelectionKeys.has(current) ? current : null));
  }, [existingSelectionKeys]);

  return {
    activeFolder,
    beginGeneratedNodeTimelineDrag: (event: ReactDragEvent<HTMLElement>, node: WorkspaceGraphNode) =>
      beginGeneratedNodeTimelineDrag(event, node, studioCanvasNodeCopy),
    beginProjectAssetTimelineDrag: (event: ReactDragEvent<HTMLElement>, asset: WorkspaceAssetRecord) =>
      beginProjectAssetTimelineDrag(event, asset, studioCanvasNodeCopy),
    endProjectMediaTimelineDrag,
    contextMenu,
    deleteMenuItem,
    deleteSelected,
    duplicateMenuItem,
    importMedia,
    insertMenuItem,
    mediaKindFilter,
    moveMenuItem,
    openContextMenu,
    openRootFolder,
    renameMenuItem,
    searchQuery,
    selectGeneratedNode,
    selectProjectAsset,
    selectProjectMediaFolder,
    selectedCanDelete,
    selectedCount: selectedMediaItems.length,
    canMoveMediaToFolder,
    selectedKey,
    selectedKeySet,
    selectSequence,
    setMediaKindFilter: setProjectMediaKindFilter,
    folderDropTargetId,
    handleFolderDragLeave,
    handleFolderDragOver,
    handleFolderDrop,
    handleProjectMediaDragOver,
    handleProjectMediaDrop,
    setContextMenu,
    setSearchQuery,
    totalItems,
    visibleItemCount,
    visibleFolders,
    visibleGeneratedNodes,
    visibleProjectAssets,
    visibleSequences,
  };
}
