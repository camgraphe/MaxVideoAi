import clsx from 'clsx';
import {
  formatDate,
  getSurfaceRoleLabel,
  getSurfaceRoleTone,
  getSurfaceStatusLabel,
  getSurfaceStatusTone,
  getUsageLabel,
  summarizePlaylist,
} from './playlist-helpers';
import type { EditablePlaylist } from './playlist-types';
import { StatusPill } from './PlaylistStatusPill';

export function PlaylistRailCard({
  playlist,
  isActive,
  onSelect,
}: {
  playlist: EditablePlaylist;
  isActive: boolean;
  onSelect: (playlistId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(playlist.id)}
      className={clsx(
        'w-full rounded-card border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        isActive
          ? 'border-brand bg-surface-2 shadow-card'
          : 'border-hairline bg-surface hover:border-text-muted hover:bg-surface-2'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-semibold text-text-primary">{playlist.name}</p>
          <p className="truncate text-xs text-text-muted">{playlist.slug}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <StatusPill tone={getSurfaceRoleTone(playlist.surfaceRole)}>{getSurfaceRoleLabel(playlist.surfaceRole)}</StatusPill>
          <StatusPill tone={getSurfaceStatusTone(playlist.surfaceStatus)}>{getSurfaceStatusLabel(playlist.surfaceStatus)}</StatusPill>
        </div>
      </div>
      <p className="mt-3 text-xs text-text-secondary">{summarizePlaylist(playlist)}</p>
      {playlist.helperText ? <p className="mt-2 text-[11px] leading-5 text-text-muted">{playlist.helperText}</p> : null}
      <p className="mt-2 text-[11px] text-text-muted">Last added: {formatDate(playlist.lastAddedAt)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {playlist.usageTargets.map((target) => (
          <StatusPill key={target} tone={playlist.surfaceRole === 'starter' || playlist.surfaceRole === 'examplesHub' ? 'ok' : 'neutral'}>
            {getUsageLabel(target)}
          </StatusPill>
        ))}
        {playlist.isLocked ? <StatusPill tone="neutral">Locked</StatusPill> : null}
      </div>
    </button>
  );
}
