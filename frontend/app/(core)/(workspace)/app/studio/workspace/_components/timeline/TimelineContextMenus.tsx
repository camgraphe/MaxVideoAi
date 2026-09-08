import { Link2, Plus, Trash2, Unlink2 } from 'lucide-react';
import { memo, useEffect, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent } from 'react';

import styles from '../../_styles/timeline-context-menu.module.css';
import type { WorkspaceTimelineTrack } from '../../_lib/workspace-types';
import {
  localizeWorkspaceTimelineTrackKindLabel,
  localizeWorkspaceTimelineTrackLabel,
} from '../../_lib/workspace-timeline-tracks';
import type { StudioCopy } from '../../../_lib/studio-copy';

export type TimelineContextMenuState = {
  canLink: boolean;
  canUnlink: boolean;
  itemIds: string[];
  selectedClipCount: number;
  x: number;
  y: number;
};

export type TimelineTrackContextMenuState = {
  canAdd: boolean;
  canDelete: boolean;
  kind: 'video' | 'audio';
  label: string;
  trackId: WorkspaceTimelineTrack;
  x: number;
  y: number;
};

type TimelineContextMenusProps = {
  copy: StudioCopy['timeline'];
  canvasNodeCopy: StudioCopy['canvas']['nodes'];
  clipMenu: TimelineContextMenuState | null;
  onClipMenuAction: (action: 'link' | 'unlink') => void;
  onTrackMenuAction: (action: 'add' | 'delete') => void;
  trackMenu: TimelineTrackContextMenuState | null;
};

function stopMenuPointer(event: MouseEvent<HTMLDivElement> | ReactPointerEvent<HTMLDivElement>) {
  event.stopPropagation();
}

export const TimelineContextMenus = memo(function TimelineContextMenus({
  copy,
  canvasNodeCopy,
  clipMenu,
  onClipMenuAction,
  onTrackMenuAction,
  trackMenu,
}: TimelineContextMenusProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!clipMenu && !trackMenu) return;
    const launcher = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    rootRef.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    return () => { if (launcher?.isConnected) launcher.focus(); };
  }, [clipMenu, trackMenu]);
  const navigateMenu = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    const index = buttons.findIndex((button) => button === document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };
  const trackLabel = trackMenu ? localizeWorkspaceTimelineTrackLabel(trackMenu.trackId, canvasNodeCopy) : '';
  const trackKindLabel = trackMenu
    ? localizeWorkspaceTimelineTrackKindLabel(trackMenu.kind, canvasNodeCopy).toLocaleLowerCase()
    : '';

  return (
    <div ref={rootRef} onKeyDown={navigateMenu}>
      {clipMenu ? (
        <div
          className={styles.timelineContextMenu}
          style={{ left: clipMenu.x, top: clipMenu.y }}
          role="menu"
          data-timeline-control="true"
          onContextMenu={(event) => event.preventDefault()}
          onMouseDown={stopMenuPointer}
          onPointerDown={stopMenuPointer}
        >
          <span>
            {(clipMenu.selectedClipCount === 1 ? copy.tracks.clipSelected : copy.tracks.clipsSelected)
              .replace('{count}', String(clipMenu.selectedClipCount))}
          </span>
          <button
            type="button"
            role="menuitem"
            disabled={!clipMenu.canUnlink}
            onClick={() => onClipMenuAction('unlink')}
          >
            <Unlink2 size={14} />
            {copy.clips.unlinkSelected}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!clipMenu.canLink}
            onClick={() => onClipMenuAction('link')}
          >
            <Link2 size={14} />
            {copy.clips.linkSelected}
          </button>
        </div>
      ) : null}
      {trackMenu ? (
        <div
          className={styles.timelineContextMenu}
          style={{ left: trackMenu.x, top: trackMenu.y }}
          role="menu"
          data-timeline-control="true"
          onContextMenu={(event) => event.preventDefault()}
          onMouseDown={stopMenuPointer}
          onPointerDown={stopMenuPointer}
        >
          <span>{copy.tracks.trackContextLabel.replace('{track}', trackLabel)}</span>
          <button
            type="button"
            role="menuitem"
            disabled={!trackMenu.canAdd}
            onClick={() => onTrackMenuAction('add')}
          >
            <Plus size={14} />
            {copy.tracks.addTrack.replace('{kind}', trackKindLabel)}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!trackMenu.canDelete}
            onClick={() => onTrackMenuAction('delete')}
          >
            <Trash2 size={14} />
            {copy.tracks.deleteTrack.replace('{kind}', trackKindLabel)}
          </button>
        </div>
      ) : null}
    </div>
  );
});
