import { useEffect } from 'react';

function isTimelineShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function timelineShortcutLetter(event: globalThis.KeyboardEvent): string {
  const key = event.key.toLowerCase();
  if (/^[a-z]$/.test(key)) return key;
  const codeMatch = event.code.match(/^Key([A-Z])$/);
  return codeMatch?.[1].toLowerCase() ?? '';
}

function timelineHistoryShortcut(event: globalThis.KeyboardEvent): 'redo' | 'undo' | null {
  if (!event.metaKey && !event.ctrlKey) return null;
  const key = timelineShortcutLetter(event);
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y') return 'redo';
  return null;
}

type UseTimelineKeyboardShortcutsOptions = {
  canRedo: boolean;
  canUndo: boolean;
  frameStepSec: number;
  isShortcutActive: boolean;
  onCutAtPlayhead: () => void;
  onDeleteItem: (ripple?: boolean) => void;
  onGoToCut: (direction: -1 | 1) => void;
  onMarkIn: () => void;
  onMarkOut: () => void;
  onRedo: () => void;
  onSeekBy: (deltaSec: number) => void;
  onSelectTool: () => void;
  onToggleBladeTool: () => void;
  onTogglePlayback: () => void;
  onToggleSnap: () => void;
  onUndo: () => void;
  onZoomBy: (deltaPixelsPerSecond: number) => void;
};

export function useTimelineKeyboardShortcuts({
  canRedo,
  canUndo,
  frameStepSec,
  isShortcutActive,
  onCutAtPlayhead,
  onDeleteItem,
  onGoToCut,
  onMarkIn,
  onMarkOut,
  onRedo,
  onSeekBy,
  onSelectTool,
  onToggleBladeTool,
  onTogglePlayback,
  onToggleSnap,
  onUndo,
  onZoomBy,
}: UseTimelineKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const historyShortcut = timelineHistoryShortcut(event);
      if (historyShortcut) {
        if (!isShortcutActive) return;
        if (isTimelineShortcutTarget(event.target)) return;
        event.preventDefault();
        if (historyShortcut === 'redo') {
          if (canRedo) onRedo();
        } else if (canUndo) {
          onUndo();
        }
        return;
      }

      if (!isShortcutActive) return;
      if (isTimelineShortcutTarget(event.target)) return;

      if ((event.metaKey || event.ctrlKey) && (event.code === 'Equal' || event.code === 'NumpadAdd')) {
        event.preventDefault();
        onZoomBy(8);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && (event.code === 'Minus' || event.code === 'NumpadSubtract')) {
        event.preventDefault();
        onZoomBy(-8);
        return;
      }

      if (event.code === 'Space' || event.key === ' ' || event.key === 'Space' || event.key === 'Spacebar') {
        event.preventDefault();
        onTogglePlayback();
        return;
      }

      if (event.code === 'ArrowLeft') {
        event.preventDefault();
        onSeekBy(event.shiftKey ? -1 : -frameStepSec);
        return;
      }

      if (event.code === 'ArrowRight') {
        event.preventDefault();
        onSeekBy(event.shiftKey ? 1 : frameStepSec);
        return;
      }

      if (event.code === 'ArrowUp') {
        event.preventDefault();
        onGoToCut(-1);
        return;
      }

      if (event.code === 'ArrowDown') {
        event.preventDefault();
        onGoToCut(1);
        return;
      }

      if (event.code === 'KeyC') {
        event.preventDefault();
        onToggleBladeTool();
        return;
      }

      if (event.code === 'KeyV') {
        event.preventDefault();
        onSelectTool();
        return;
      }

      if (event.code === 'KeyM') {
        event.preventDefault();
        onToggleSnap();
        return;
      }

      if (event.code === 'KeyI') {
        event.preventDefault();
        onMarkIn();
        return;
      }

      if (event.code === 'KeyO') {
        event.preventDefault();
        onMarkOut();
        return;
      }

      if (event.code === 'Delete' || event.code === 'Backspace') {
        event.preventDefault();
        onDeleteItem(event.shiftKey);
        return;
      }

      if (event.code === 'KeyS' || ((event.metaKey || event.ctrlKey) && event.code === 'KeyB')) {
        event.preventDefault();
        onCutAtPlayhead();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canRedo,
    canUndo,
    frameStepSec,
    isShortcutActive,
    onCutAtPlayhead,
    onDeleteItem,
    onGoToCut,
    onMarkIn,
    onMarkOut,
    onRedo,
    onSeekBy,
    onSelectTool,
    onToggleBladeTool,
    onTogglePlayback,
    onToggleSnap,
    onUndo,
    onZoomBy,
  ]);
}
