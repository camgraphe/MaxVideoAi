import { useId } from 'react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import type {
  ModerationVideo,
  PlaylistOption,
  PlaylistTag,
} from '@/components/admin/moderation/moderation-types';

type PlaylistState = {
  loading: boolean;
  message: string | null;
  error: string | null;
};

export function ModerationPlaylistControls({
  assignedPlaylists,
  compact = false,
  emphasizeAssigned = false,
  enabled = true,
  isLoadingPlaylists,
  onAssign,
  onRemove,
  orderedPlaylists,
  playlistState,
  video,
}: {
  assignedPlaylists: PlaylistTag[];
  compact?: boolean;
  emphasizeAssigned?: boolean;
  enabled?: boolean;
  isLoadingPlaylists: boolean;
  onAssign: (video: ModerationVideo, playlistId: string) => void;
  onRemove: (video: ModerationVideo, playlistId: string) => void;
  orderedPlaylists: PlaylistOption[];
  playlistState?: PlaylistState;
  video: ModerationVideo;
}) {
  const generatedPlaylistSelectId = useId();

  if (!enabled) return null;

  const isAssigningPlaylist = Boolean(playlistState?.loading);
  const playlistMessage = playlistState?.message ?? null;
  const playlistErrorMessage = playlistState?.error ?? null;
  const playlistSelectId = `moderation-playlist-${generatedPlaylistSelectId}`;

  return (
    <div className="space-y-2 text-xs">
      {assignedPlaylists.length ? (
        <div className={clsx('flex flex-wrap gap-2', emphasizeAssigned && 'gap-1.5')}>
          {assignedPlaylists.map((playlist) => (
            <Button
              key={`${video.id}-${playlist.id}`}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onRemove(video, playlist.id)}
              disabled={isAssigningPlaylist}
              className={clsx(
                'min-h-0 h-auto gap-1 rounded-pill px-2 py-1 text-[11px]',
                emphasizeAssigned
                  ? 'border-success-border bg-success-bg font-semibold text-success hover:border-error-border hover:text-error'
                  : 'border-border bg-bg text-text-secondary hover:border-error-border hover:text-error'
              )}
            >
              {playlist.name}
              <span aria-hidden>×</span>
              <span className="sr-only">Remove from {playlist.name}</span>
            </Button>
          ))}
        </div>
      ) : compact ? (
        <p className="text-[11px] text-text-muted">No playlist yet</p>
      ) : (
        <p className="text-xs text-text-muted">No playlist assignment yet.</p>
      )}
      <label
        htmlFor={playlistSelectId}
        className={compact ? 'sr-only' : 'block text-[11px] font-semibold uppercase tracking-micro text-text-muted'}
      >
        Add to playlist
      </label>
      <select
        id={playlistSelectId}
        className={clsx(
          'w-full rounded-input border border-hairline bg-bg text-xs text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          compact ? 'px-2 py-1.5' : 'px-2 py-2'
        )}
        defaultValue=""
        disabled={isLoadingPlaylists || !orderedPlaylists.length || isAssigningPlaylist}
        onChange={(event) => {
          const playlistId = event.target.value;
          if (!playlistId) return;
          onAssign(video, playlistId);
          event.target.value = '';
        }}
      >
        <option value="">
          {isLoadingPlaylists ? 'Loading playlists…' : orderedPlaylists.length ? 'Select playlist' : 'No playlists'}
        </option>
        {orderedPlaylists.map((playlist) => {
          const disabled = assignedPlaylists.some((entry) => entry.id === playlist.id);
          return (
            <option key={playlist.id} value={playlist.id} disabled={disabled}>
              {playlist.usageTargets?.length ? '★ ' : ''}
              {playlist.name}
            </option>
          );
        })}
      </select>
      {playlistMessage ? <p className="text-[11px] text-success">{playlistMessage}</p> : null}
      {playlistErrorMessage ? <p className="text-[11px] text-error">{playlistErrorMessage}</p> : null}
    </div>
  );
}
