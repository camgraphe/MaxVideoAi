import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/admin/playlists/PlaylistStatusPill';
import {
  buildHelperFallbackLabel,
  formatDate,
  getSurfaceRoleLabel,
  getSurfaceRoleTone,
  getSurfaceStatusLabel,
  getSurfaceStatusTone,
  getUsageLabel,
  slugify,
} from '@/components/admin/playlists/playlist-helpers';
import type { EditablePlaylist } from '@/components/admin/playlists/playlist-types';

type PlaylistDetailsPanelProps = {
  isPending: boolean;
  onDeletePlaylist: (playlistId: string) => void;
  onFieldChange: (playlistId: string, field: 'name' | 'slug' | 'description', value: string) => void;
  onSavePlaylist: (playlistId: string) => void;
  onSeedFamilyPlaylist: (familyId: string) => void;
  playlist: EditablePlaylist;
};

export function PlaylistDetailsPanel({
  isPending,
  onDeletePlaylist,
  onFieldChange,
  onSavePlaylist,
  onSeedFamilyPlaylist,
  playlist,
}: PlaylistDetailsPanelProps) {
  return (
    <section className="rounded-card border border-border bg-surface p-6 shadow-card">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-text-primary">{playlist.name}</h2>
            <StatusPill tone={getSurfaceRoleTone(playlist.surfaceRole)}>
              {getSurfaceRoleLabel(playlist.surfaceRole)}
            </StatusPill>
            <StatusPill tone={getSurfaceStatusTone(playlist.surfaceStatus)}>
              {getSurfaceStatusLabel(playlist.surfaceStatus)}
            </StatusPill>
            {playlist.isLocked ? <StatusPill tone="neutral">Locked by runtime</StatusPill> : null}
          </div>
          <p className="text-sm text-text-secondary">
            {playlist.surfaceRole === 'family'
              ? 'The first positions are fully editorial here. When this playlist runs out, the page auto-fills from model playlists and then the main examples hub.'
              : playlist.isLocked
                ? 'This collection powers a live runtime surface. You can curate media and order, but metadata is read-only here.'
                : 'Editable collection metadata. Media and ordering are managed separately below.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {playlist.surfaceRole === 'family' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onSeedFamilyPlaylist(playlist.familyId ?? playlist.slug.replace(/^family-/, ''))}
              disabled={isPending}
            >
              Seed from current order
            </Button>
          ) : null}
          {!playlist.isLocked ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onDeletePlaylist(playlist.id)}
                disabled={isPending}
              >
                Delete collection
              </Button>
              <Button type="button" size="sm" onClick={() => onSavePlaylist(playlist.id)} disabled={!playlist.dirty || isPending}>
                Save details
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Name</span>
          <input
            type="text"
            value={playlist.name}
            onChange={(event) => onFieldChange(playlist.id, 'name', event.target.value)}
            disabled={playlist.isLocked}
            className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-surface-2 disabled:text-text-muted"
          />
        </label>
        <label className="text-sm">
          <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Slug</span>
          <input
            type="text"
            value={playlist.slug}
            onChange={(event) => onFieldChange(playlist.id, 'slug', slugify(event.target.value))}
            disabled={playlist.isLocked}
            className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-surface-2 disabled:text-text-muted"
          />
        </label>
      </div>

      <label className="mt-4 block text-sm">
        <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Description</span>
        <textarea
          value={playlist.description ?? ''}
          onChange={(event) => onFieldChange(playlist.id, 'description', event.target.value)}
          disabled={playlist.isLocked}
          rows={3}
          className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-surface-2 disabled:text-text-muted"
        />
      </label>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-card border border-hairline bg-bg px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Items</p>
          <p className="mt-2 text-lg font-semibold text-text-primary">{playlist.itemCount}</p>
        </div>
        <div className="rounded-card border border-hairline bg-bg px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Live on site</p>
          <p className="mt-2 text-lg font-semibold text-text-primary">{playlist.siteVisibleCount}</p>
        </div>
        <div className="rounded-card border border-hairline bg-bg px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Last added</p>
          <p className="mt-2 text-sm font-semibold text-text-primary">{formatDate(playlist.lastAddedAt)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-hairline bg-bg px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Helper</p>
          <p className="mt-2 text-sm text-text-secondary">
            {playlist.helperText ?? 'No helper text for this collection.'}
          </p>
          {playlist.drivesRoute ? (
            <div className="mt-3">
              <StatusPill tone="neutral">{playlist.drivesRoute}</StatusPill>
            </div>
          ) : null}
        </div>
        <div className="rounded-card border border-hairline bg-bg px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Fallback model playlists</p>
          {playlist.fallbackModelSlugs.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {playlist.fallbackModelSlugs.map((modelSlug) => (
                <StatusPill key={modelSlug} tone="neutral">
                  {buildHelperFallbackLabel(modelSlug)}
                </StatusPill>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-text-secondary">No automatic fallback configured.</p>
          )}
        </div>
      </div>

      {playlist.usageTargets.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {playlist.usageTargets.map((target) => (
            <StatusPill key={target} tone="neutral">
              {getUsageLabel(target)}
            </StatusPill>
          ))}
        </div>
      ) : null}
    </section>
  );
}
