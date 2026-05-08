"use client";

import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
} from 'react';
import type { DropPlacement, PlaylistItemRecord } from '@/components/admin/playlists/playlist-types';

type UsePlaylistDragReorderOptions = {
  setItems: Dispatch<SetStateAction<PlaylistItemRecord[]>>;
  setItemsDirty: Dispatch<SetStateAction<boolean>>;
};

export function usePlaylistDragReorder({ setItems, setItemsDirty }: UsePlaylistDragReorderOptions) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropAtEnd, setDropAtEnd] = useState(false);
  const [dropPlacement, setDropPlacement] = useState<DropPlacement>('before');
  const dragGhostRef = useRef<HTMLElement | null>(null);
  const draggingIdRef = useRef<string | null>(null);

  const clearDragState = useCallback(() => {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
    setDropAtEnd(false);
    setDropPlacement('before');
  }, []);

  const clearDragGhost = useCallback(() => {
    if (dragGhostRef.current) {
      dragGhostRef.current.remove();
      dragGhostRef.current = null;
    }
  }, []);

  const commitDragMove = useCallback(
    (fromId: string, toId: string | null, placement: DropPlacement = 'before') => {
      setItems((current) => {
        const fromIndex = current.findIndex((item) => item.videoId === fromId);
        if (fromIndex === -1) return current;
        const next = [...current];
        const [moved] = next.splice(fromIndex, 1);
        const insertIndex = toId ? next.findIndex((item) => item.videoId === toId) : next.length;
        const targetIndex = insertIndex === -1 ? next.length : placement === 'after' ? insertIndex + 1 : insertIndex;
        next.splice(targetIndex, 0, moved);
        return next.map((item, orderIndex) => ({ ...item, orderIndex }));
      });
      setItemsDirty(true);
      clearDragState();
    },
    [clearDragState, setItems, setItemsDirty]
  );

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLElement>, videoId: string) => {
      clearDragGhost();
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', videoId);
      const source = event.currentTarget;
      const ghost = source.cloneNode(true) as HTMLElement;
      ghost.style.position = 'fixed';
      ghost.style.top = '-10000px';
      ghost.style.left = '-10000px';
      ghost.style.width = `${source.clientWidth}px`;
      ghost.style.pointerEvents = 'none';
      ghost.style.opacity = '0.92';
      ghost.style.transform = 'scale(0.98)';
      ghost.style.boxShadow = '0 24px 60px rgba(0, 0, 0, 0.28)';
      ghost.style.borderRadius = '20px';
      ghost.style.overflow = 'hidden';
      ghost.style.zIndex = '9999';
      document.body.appendChild(ghost);
      dragGhostRef.current = ghost;
      event.dataTransfer.setDragImage(ghost, source.clientWidth / 2, 32);
      draggingIdRef.current = videoId;
      setDraggingId(videoId);
      setDropTargetId(null);
      setDropAtEnd(false);
      setDropPlacement('before');
    },
    [clearDragGhost]
  );

  const handleDragEnd = useCallback(() => {
    clearDragGhost();
    clearDragState();
  }, [clearDragGhost, clearDragState]);

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (event.target === event.currentTarget) {
      setDropTargetId(null);
      setDropAtEnd(true);
      setDropPlacement('after');
    }
  }, []);

  const handleCardDragOver = useCallback(
    (event: DragEvent<HTMLElement>, videoId: string) => {
      handleDragOver(event);
      const activeDraggingId = draggingIdRef.current;
      if (!activeDraggingId || activeDraggingId === videoId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const nextPlacement: DropPlacement = event.clientY >= rect.top + rect.height / 2 ? 'after' : 'before';
      setDropTargetId(videoId);
      setDropAtEnd(false);
      setDropPlacement(nextPlacement);
    },
    [handleDragOver]
  );

  const handleDropOnCard = useCallback(
    (event: DragEvent<HTMLElement>, targetVideoId: string) => {
      event.preventDefault();
      const activeDraggingId = draggingIdRef.current;
      if (!activeDraggingId || activeDraggingId === targetVideoId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const nextPlacement: DropPlacement = event.clientY >= rect.top + rect.height / 2 ? 'after' : 'before';
      commitDragMove(activeDraggingId, targetVideoId, nextPlacement);
    },
    [commitDragMove]
  );

  const handleDropAtEnd = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      const activeDraggingId = draggingIdRef.current;
      if (!activeDraggingId) return;
      commitDragMove(activeDraggingId, null, 'after');
    },
    [commitDragMove]
  );

  const handleDropOnPlaceholder = useCallback(
    (event: DragEvent<HTMLElement>, targetVideoId: string | null, placement: DropPlacement) => {
      event.preventDefault();
      event.stopPropagation();
      const activeDraggingId = draggingIdRef.current;
      if (!activeDraggingId) return;
      commitDragMove(activeDraggingId, targetVideoId, placement);
    },
    [commitDragMove]
  );

  return {
    clearDragState,
    draggingId,
    dropAtEnd,
    dropPlacement,
    dropTargetId,
    handleCardDragOver,
    handleDragEnd,
    handleDragOver,
    handleDragStart,
    handleDropAtEnd,
    handleDropOnCard,
    handleDropOnPlaceholder,
  };
}
