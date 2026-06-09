import { Link2, Plus, Trash2, Unlink2 } from 'lucide-react';
import { memo } from 'react';
import type { MouseEvent, PointerEvent as ReactPointerEvent } from 'react';

import styles from '../../maxvideoai-editor.module.css';
import type { WorkspaceTimelineTrack } from '../../_lib/workspace-types';

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
  clipMenu: TimelineContextMenuState | null;
  onClipMenuAction: (action: 'link' | 'unlink') => void;
  onTrackMenuAction: (action: 'add' | 'delete') => void;
  trackMenu: TimelineTrackContextMenuState | null;
};

function stopMenuPointer(event: MouseEvent<HTMLDivElement> | ReactPointerEvent<HTMLDivElement>) {
  event.stopPropagation();
}

export const TimelineContextMenus = memo(function TimelineContextMenus({
  clipMenu,
  onClipMenuAction,
  onTrackMenuAction,
  trackMenu,
}: TimelineContextMenusProps) {
  return (
    <>
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
          <span>{clipMenu.selectedClipCount} clip{clipMenu.selectedClipCount > 1 ? 's' : ''} selected</span>
          <button
            type="button"
            role="menuitem"
            disabled={!clipMenu.canUnlink}
            onClick={() => onClipMenuAction('unlink')}
          >
            <Unlink2 size={14} />
            Unlink selected clips
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!clipMenu.canLink}
            onClick={() => onClipMenuAction('link')}
          >
            <Link2 size={14} />
            Link selected clips
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
          <span>{trackMenu.label} track</span>
          <button
            type="button"
            role="menuitem"
            disabled={!trackMenu.canAdd}
            onClick={() => onTrackMenuAction('add')}
          >
            <Plus size={14} />
            Add {trackMenu.kind} track
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!trackMenu.canDelete}
            onClick={() => onTrackMenuAction('delete')}
          >
            <Trash2 size={14} />
            Delete {trackMenu.kind} track
          </button>
        </div>
      ) : null}
    </>
  );
});
