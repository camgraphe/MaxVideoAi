'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent } from 'react';

import {
  selectionKeyForTimelineItem,
  selectionKeysForTimelineItemIds,
} from '../../_lib/timeline/timeline-interaction';
import type { WorkspaceTimelineItem, WorkspaceTimelineTrack } from '../../_lib/workspace-types';
import type { TimelineSelectionMode } from './TimelineClip';
import type { TimelineContextMenuState, TimelineTrackContextMenuState } from './TimelineContextMenus';
import type { TimelineTrackDefinition } from './timelineTrackDefinitions';

type UseTimelineContextMenusOptions = {
  audioTrackCount: number;
  items: WorkspaceTimelineItem[];
  maxAudioTrackCount: number;
  maxVideoTrackCount: number;
  minAudioTrackCount: number;
  onAddAudioTrack: () => void;
  onAddVideoTrack: () => void;
  onDeleteTrack: (track: WorkspaceTimelineTrack) => void;
  onLinkItems: (itemIds: string[]) => void;
  onSelectItem: (itemId: string, mode?: TimelineSelectionMode) => void;
  onUnlinkItems: (itemIds: string[]) => void;
  selectedItemIds: string[];
  selectedKeys: ReadonlySet<string>;
  videoTrackCount: number;
};

export function useTimelineContextMenus({
  audioTrackCount,
  items,
  maxAudioTrackCount,
  maxVideoTrackCount,
  minAudioTrackCount,
  onAddAudioTrack,
  onAddVideoTrack,
  onDeleteTrack,
  onLinkItems,
  onSelectItem,
  onUnlinkItems,
  selectedItemIds,
  selectedKeys,
  videoTrackCount,
}: UseTimelineContextMenusOptions) {
  const [clipMenu, setClipMenu] = useState<TimelineContextMenuState | null>(null);
  const [trackMenu, setTrackMenu] = useState<TimelineTrackContextMenuState | null>(null);

  const clearTimelineContextMenus = useCallback(() => {
    setClipMenu(null);
    setTrackMenu(null);
  }, []);

  const handleOpenClipContextMenu = useCallback((event: MouseEvent<HTMLDivElement>, item: WorkspaceTimelineItem) => {
    event.preventDefault();
    event.stopPropagation();
    const clickedKey = selectionKeyForTimelineItem(item);
    const isClickedSelected = selectedKeys.has(clickedKey);
    const menuItemIds = isClickedSelected && selectedItemIds.length ? selectedItemIds : [item.id];
    const menuKeys = selectionKeysForTimelineItemIds(items, menuItemIds);
    const menuItems = items.filter((candidate) => menuKeys.has(selectionKeyForTimelineItem(candidate)));
    const linkedGroupIds = new Set(
      menuItems
        .map((candidate) => candidate.linkedGroupId)
        .filter((groupId): groupId is string => Boolean(groupId))
    );
    if (!isClickedSelected) {
      onSelectItem(item.id, 'replace');
    }
    const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
    setClipMenu({
      canLink: menuKeys.size > 1,
      canUnlink: linkedGroupIds.size > 0,
      itemIds: menuItemIds,
      selectedClipCount: menuItems.length,
      x: viewportWidth ? Math.min(event.clientX, Math.max(12, viewportWidth - 224)) : event.clientX,
      y: viewportHeight ? Math.min(event.clientY, Math.max(12, viewportHeight - 120)) : event.clientY,
    });
  }, [items, onSelectItem, selectedItemIds, selectedKeys]);

  const handleClipContextMenuAction = useCallback((action: 'link' | 'unlink') => {
    if (!clipMenu) return;
    if (action === 'link') onLinkItems(clipMenu.itemIds);
    else onUnlinkItems(clipMenu.itemIds);
    setClipMenu(null);
  }, [clipMenu, onLinkItems, onUnlinkItems]);

  const handleOpenTrackContextMenu = useCallback((event: MouseEvent<HTMLDivElement>, track: TimelineTrackDefinition) => {
    event.preventDefault();
    event.stopPropagation();
    setClipMenu(null);
    const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
    setTrackMenu({
      canAdd: track.kind === 'video' ? videoTrackCount < maxVideoTrackCount : audioTrackCount < maxAudioTrackCount,
      canDelete: track.kind === 'video' ? videoTrackCount > 1 : audioTrackCount > minAudioTrackCount,
      kind: track.kind,
      label: track.label,
      trackId: track.id,
      x: viewportWidth ? Math.min(event.clientX, Math.max(12, viewportWidth - 212)) : event.clientX,
      y: viewportHeight ? Math.min(event.clientY, Math.max(12, viewportHeight - 118)) : event.clientY,
    });
  }, [audioTrackCount, maxAudioTrackCount, maxVideoTrackCount, minAudioTrackCount, videoTrackCount]);

  const handleTrackContextMenuAction = useCallback((action: 'add' | 'delete') => {
    if (!trackMenu) return;
    if (action === 'add') {
      if (trackMenu.kind === 'video') onAddVideoTrack();
      else onAddAudioTrack();
    } else {
      onDeleteTrack(trackMenu.trackId);
    }
    setTrackMenu(null);
  }, [onAddAudioTrack, onAddVideoTrack, onDeleteTrack, trackMenu]);

  useEffect(() => {
    if (!clipMenu && !trackMenu) return undefined;
    const closeContextMenu = () => {
      setClipMenu(null);
      setTrackMenu(null);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu();
    };
    window.addEventListener('pointerdown', closeContextMenu);
    window.addEventListener('scroll', closeContextMenu, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', closeContextMenu);
      window.removeEventListener('scroll', closeContextMenu, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [clipMenu, trackMenu]);

  return {
    clearTimelineContextMenus,
    clipMenu,
    handleClipContextMenuAction,
    handleOpenClipContextMenu,
    handleOpenTrackContextMenu,
    handleTrackContextMenuAction,
    trackMenu,
  };
}
