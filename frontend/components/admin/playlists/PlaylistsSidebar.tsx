import clsx from 'clsx';
import { GROUP_LABELS } from './playlist-helpers';
import type { EditablePlaylist, FamilyPlaylistHelperCard, ModelPlaylistHelperCard } from './playlist-types';
import { MissingFamilyCard } from './MissingFamilyCard';
import { MissingModelCard } from './MissingModelCard';
import { PlaylistRailCard } from './PlaylistRailCard';

export function PlaylistsSidebar({
  emptyFamilyCount,
  familyHelpers,
  modelHelpers,
  groupedPlaylists,
  onCreateMissingFamilyPlaylists,
  onCreateMissingModelPlaylists,
  onSeedFamilyPlaylist,
  onSeedModelPlaylist,
  onSelectPlaylist,
  onToggleFamilyCollections,
  onToggleModelCollections,
  pending,
  selectedId,
  showDraftCollections,
  showFamilyCollections,
  showModelCollections,
}: {
  emptyFamilyCount: number;
  familyHelpers: FamilyPlaylistHelperCard[];
  modelHelpers: ModelPlaylistHelperCard[];
  groupedPlaylists: {
    runtime: EditablePlaylist[];
    family: EditablePlaylist[];
    model: EditablePlaylist[];
    draft: EditablePlaylist[];
  };
  onCreateMissingFamilyPlaylists: (familyId?: string | null) => void;
  onCreateMissingModelPlaylists: (modelSlug?: string | null) => void;
  onSeedFamilyPlaylist: (familyId: string) => void;
  onSeedModelPlaylist: (modelSlug: string) => void;
  onSelectPlaylist: (playlistId: string) => void;
  onToggleFamilyCollections: () => void;
  onToggleModelCollections: () => void;
  pending: boolean;
  selectedId: string | null;
  showDraftCollections: boolean;
  showFamilyCollections: boolean;
  showModelCollections: boolean;
}) {
  return (
    <aside className="space-y-6">
      {groupedPlaylists.runtime.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{GROUP_LABELS.runtime}</h2>
            <span className="text-xs text-text-muted">{groupedPlaylists.runtime.length}</span>
          </div>
          <div className="space-y-2">
            {groupedPlaylists.runtime.map((playlist) => (
              <PlaylistRailCard
                key={playlist.id}
                playlist={playlist}
                isActive={playlist.id === selectedId}
                onSelect={onSelectPlaylist}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onToggleFamilyCollections}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            <DisclosureIcon open={showFamilyCollections} />
            <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{GROUP_LABELS.family}</h2>
          </button>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            {emptyFamilyCount ? <span>{emptyFamilyCount} empty</span> : null}
            <span>{familyHelpers.length}</span>
          </div>
        </div>
        {showFamilyCollections ? (
          <div className="space-y-2">
            {familyHelpers.map((helper) => {
              const playlist = helper.playlistId
                ? groupedPlaylists.family.find((entry) => entry.id === helper.playlistId) ?? null
                : null;
              if (playlist) {
                return (
                  <PlaylistRailCard
                    key={playlist.id}
                    playlist={playlist}
                    isActive={playlist.id === selectedId}
                    onSelect={onSelectPlaylist}
                  />
                );
              }
              return (
                <MissingFamilyCard
                  key={helper.familyId}
                  helper={helper}
                  onCreate={(familyId) => onCreateMissingFamilyPlaylists(familyId)}
                  onSeed={onSeedFamilyPlaylist}
                  pending={pending}
                />
              );
            })}
          </div>
        ) : null}
      </section>

      {modelHelpers.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onToggleModelCollections}
              className="flex min-w-0 items-center gap-2 text-left"
            >
              <DisclosureIcon open={showModelCollections} />
              <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{GROUP_LABELS.model}</h2>
            </button>
            <span className="text-xs text-text-muted">{modelHelpers.length}</span>
          </div>
          {showModelCollections ? (
            <div className="space-y-2">
              {modelHelpers.map((helper) => {
                const playlist = helper.playlistId
                  ? groupedPlaylists.model.find((entry) => entry.id === helper.playlistId) ?? null
                  : null;
                if (playlist) {
                  return (
                    <PlaylistRailCard
                      key={playlist.id}
                      playlist={playlist}
                      isActive={playlist.id === selectedId}
                      onSelect={onSelectPlaylist}
                    />
                  );
                }
                return (
                  <MissingModelCard
                    key={helper.modelSlug}
                    helper={helper}
                    onCreate={(modelSlug) => onCreateMissingModelPlaylists(modelSlug)}
                    onSeed={onSeedModelPlaylist}
                    pending={pending}
                  />
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      {showDraftCollections && groupedPlaylists.draft.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{GROUP_LABELS.draft}</h2>
            <span className="text-xs text-text-muted">{groupedPlaylists.draft.length}</span>
          </div>
          <div className="space-y-2">
            {groupedPlaylists.draft.map((playlist) => (
              <PlaylistRailCard
                key={playlist.id}
                playlist={playlist}
                isActive={playlist.id === selectedId}
                onSelect={onSelectPlaylist}
              />
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function DisclosureIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={clsx('h-4 w-4 text-text-muted transition-transform', open ? 'rotate-90' : 'rotate-0')}
    >
      <path
        d="M7.5 5.5 12 10l-4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
