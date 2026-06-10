'use client';

import { useCallback, useEffect, useMemo, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphNode,
  WorkspaceProjectSettings,
} from '../_lib/workspace-types';
import {
  applyProjectMediaTimelineDragPayload,
  projectMediaAssetThumbnailUrl,
  projectMediaGeneratedThumbnailUrl,
  projectMediaTimelineDragPayloadForAsset,
  projectMediaTimelineDragPayloadForGeneratedNode,
  projectMediaTimelineKindForAsset,
  projectMediaTimelineKindForGeneratedNode,
} from '../_lib/workspace-project-media-drag';

const MEDIA_DETAIL_SEPARATOR = ' • ';

export type ProjectMediaSelection =
  | { id: string; type: 'asset' | 'generated' | 'sequence' }
  | null;

export type ProjectMediaContextMenu = {
  id: string;
  title: string;
  type: 'asset' | 'generated' | 'sequence';
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
  sequences: WorkspaceProjectSequenceSummary[];
  onClearSequenceInspector: () => void;
  onDeleteGeneratedClip: (nodeId: string) => void;
  onDeleteProjectAsset: (assetId: string) => void;
  onDeleteSequence: (sequenceId: string) => void;
  onDuplicateSequence: (sequenceId: string) => void;
  onImportMedia: () => void;
  onInspectSequence: (sequenceId: string) => void;
  onInsertGeneratedClip: (nodeId: string) => void;
  onInsertProjectAsset: (assetId: string) => void;
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

function generatedClipNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
  return nodes.filter((node) => node.data.kind === 'output' && Boolean(node.data.output));
}

function mediaCardKindForAsset(asset: WorkspaceAssetRecord): 'audio' | 'image' | 'video' {
  if (asset.kind === 'audio') return 'audio';
  if (asset.kind === 'video') return 'video';
  return 'image';
}

function mediaSubtitleForAsset(asset: WorkspaceAssetRecord): string {
  if (asset.kind === 'audio') {
    return [asset.durationSec ? formatProjectMediaDuration(asset.durationSec) : null, '48kHz'].filter(Boolean).join(MEDIA_DETAIL_SEPARATOR);
  }
  if (asset.kind === 'video') {
    return [asset.durationSec ? formatProjectMediaDuration(asset.durationSec) : null, asset.dimensions, '16:9'].filter(Boolean).join(MEDIA_DETAIL_SEPARATOR);
  }
  return asset.dimensions ?? asset.subtitle;
}

function mediaSubtitleForGeneratedNode(node: WorkspaceGraphNode): string {
  const output = node.data.output;
  if (!output) return node.data.subtitle ?? 'Generated clip';
  return [output.durationSec ? formatProjectMediaDuration(output.durationSec) : null, output.modelLabel].filter(Boolean).join(MEDIA_DETAIL_SEPARATOR);
}

function beginProjectAssetTimelineDrag(event: ReactDragEvent<HTMLElement>, asset: WorkspaceAssetRecord): void {
  const payload = projectMediaTimelineDragPayloadForAsset(asset);
  if (!payload) return;
  applyProjectMediaTimelineDragPayload(event.dataTransfer, payload);
}

function beginGeneratedNodeTimelineDrag(event: ReactDragEvent<HTMLElement>, node: WorkspaceGraphNode): void {
  const payload = projectMediaTimelineDragPayloadForGeneratedNode(node);
  if (!payload) return;
  applyProjectMediaTimelineDragPayload(event.dataTransfer, payload);
}

export function useProjectMediaController({
  nodes,
  projectAssets,
  sequences,
  onClearSequenceInspector,
  onDeleteGeneratedClip,
  onDeleteProjectAsset,
  onDeleteSequence,
  onDuplicateSequence,
  onImportMedia,
  onInspectSequence,
  onInsertGeneratedClip,
  onInsertProjectAsset,
  onSelectSequence,
}: UseProjectMediaControllerArgs) {
  const generatedNodes = useMemo(() => generatedClipNodes(nodes), [nodes]);
  const [selectedMedia, setSelectedMedia] = useState<ProjectMediaSelection>(null);
  const [contextMenu, setContextMenu] = useState<ProjectMediaContextMenu | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const totalItems = sequences.length + projectAssets.length + generatedNodes.length;
  const selectedKey = selectedMedia ? projectMediaSelectionKey(selectedMedia.type, selectedMedia.id) : null;
  const selectedCanDelete =
    selectedMedia?.type === 'asset' ||
    selectedMedia?.type === 'generated' ||
    (selectedMedia?.type === 'sequence' && sequences.length > 1);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const matchesSearch = useMemo(() => {
    return (title: string, subtitle: string, kind: string) => {
      if (!normalizedSearchQuery) return true;
      return `${title} ${subtitle} ${kind}`.toLowerCase().includes(normalizedSearchQuery);
    };
  }, [normalizedSearchQuery]);

  const visibleSequences = useMemo(
    () => sequences.filter((sequence) => matchesSearch(
      sequence.name,
      `${formatProjectMediaDuration(sequence.durationSec)} ${sequence.clipCount} clips ${sequence.settings.aspectRatio}`,
      'sequence'
    )),
    [matchesSearch, sequences]
  );

  const visibleProjectAssets = useMemo<ProjectMediaAssetView[]>(
    () => projectAssets
      .filter((asset) => matchesSearch(asset.filename, mediaSubtitleForAsset(asset), asset.kind))
      .map((asset) => {
        const payload = projectMediaTimelineDragPayloadForAsset(asset);
        return {
          asset,
          cardKind: mediaCardKindForAsset(asset),
          key: projectMediaSelectionKey('asset', asset.id),
          mediaKind: payload?.mediaKind ?? projectMediaTimelineKindForAsset(asset),
          subtitle: mediaSubtitleForAsset(asset),
          thumbnailUrl: projectMediaAssetThumbnailUrl(asset),
          timelineDurationSec: payload?.durationSec ?? 0,
        };
      }),
    [matchesSearch, projectAssets]
  );

  const visibleGeneratedNodes = useMemo<ProjectMediaGeneratedView[]>(
    () => generatedNodes
      .filter((node) => matchesSearch(node.data.title, mediaSubtitleForGeneratedNode(node), 'generated'))
      .map((node) => {
        const payload = projectMediaTimelineDragPayloadForGeneratedNode(node);
        return {
          key: projectMediaSelectionKey('generated', node.id),
          mediaKind: payload?.mediaKind ?? projectMediaTimelineKindForGeneratedNode(node),
          node,
          subtitle: mediaSubtitleForGeneratedNode(node),
          thumbnailUrl: projectMediaGeneratedThumbnailUrl(node),
          timelineDurationSec: payload?.durationSec,
        };
      }),
    [generatedNodes, matchesSearch]
  );

  const openContextMenu = useCallback((event: ReactMouseEvent<HTMLElement>, menu: Omit<ProjectMediaContextMenu, 'x' | 'y'>) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedMedia({ id: menu.id, type: menu.type });
    setContextMenu({
      ...menu,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const selectSequence = useCallback((sequenceId: string) => {
    setSelectedMedia({ id: sequenceId, type: 'sequence' });
    onInspectSequence(sequenceId);
    onSelectSequence(sequenceId);
  }, [onInspectSequence, onSelectSequence]);

  const selectProjectAsset = useCallback((assetId: string) => {
    setSelectedMedia({ id: assetId, type: 'asset' });
    onClearSequenceInspector();
  }, [onClearSequenceInspector]);

  const selectGeneratedNode = useCallback((nodeId: string) => {
    setSelectedMedia({ id: nodeId, type: 'generated' });
    onClearSequenceInspector();
  }, [onClearSequenceInspector]);

  const insertMenuItem = useCallback((menu: ProjectMediaContextMenu) => {
    if (menu.type === 'asset') onInsertProjectAsset(menu.id);
    else if (menu.type === 'generated') onInsertGeneratedClip(menu.id);
    else selectSequence(menu.id);
  }, [onInsertGeneratedClip, onInsertProjectAsset, selectSequence]);

  const deleteMenuItem = useCallback((menu: ProjectMediaContextMenu) => {
    if (menu.type === 'asset') onDeleteProjectAsset(menu.id);
    else if (menu.type === 'generated') onDeleteGeneratedClip(menu.id);
    else onDeleteSequence(menu.id);
    setSelectedMedia(null);
  }, [onDeleteGeneratedClip, onDeleteProjectAsset, onDeleteSequence]);

  const duplicateMenuItem = useCallback((menu: ProjectMediaContextMenu) => {
    if (menu.type !== 'sequence') return;
    onDuplicateSequence(menu.id);
    setSelectedMedia(null);
  }, [onDuplicateSequence]);

  const deleteSelected = useCallback(() => {
    if (!selectedMedia || !selectedCanDelete) return;
    if (selectedMedia.type === 'asset') onDeleteProjectAsset(selectedMedia.id);
    if (selectedMedia.type === 'generated') onDeleteGeneratedClip(selectedMedia.id);
    if (selectedMedia.type === 'sequence') onDeleteSequence(selectedMedia.id);
    setSelectedMedia(null);
  }, [onDeleteGeneratedClip, onDeleteProjectAsset, onDeleteSequence, selectedCanDelete, selectedMedia]);

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

  return {
    beginGeneratedNodeTimelineDrag,
    beginProjectAssetTimelineDrag,
    contextMenu,
    deleteMenuItem,
    deleteSelected,
    duplicateMenuItem,
    importMedia: onImportMedia,
    insertMenuItem,
    openContextMenu,
    searchQuery,
    selectGeneratedNode,
    selectProjectAsset,
    selectedCanDelete,
    selectedKey,
    selectSequence,
    setContextMenu,
    setSearchQuery,
    totalItems,
    visibleGeneratedNodes,
    visibleProjectAssets,
    visibleSequences,
  };
}
