"use client";

import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { PlaylistCreateForm } from '@/components/admin/playlists/PlaylistCreateForm';
import { slugify } from '@/components/admin/playlists/playlist-helpers';

type PlaylistsManagerToolbarProps = {
  createDescription: string;
  createName: string;
  createSlug: string;
  draftCount: number;
  embedded: boolean;
  isPending: boolean;
  missingFamilyCount: number;
  missingModelCount: number;
  onCreateDescriptionChange: (value: string) => void;
  onCreateNameChange: (value: string) => void;
  onCreateSlugChange: (value: string) => void;
  onCreateSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCreateMissingFamilyPlaylists: () => void;
  onCreateMissingModelPlaylists: () => void;
  onSeedAllFamilyPlaylists: () => void;
  onSeedAllModelPlaylists: () => void;
  onToggleCreateForm: () => void;
  onToggleDraftCollections: () => void;
  showCreateForm: boolean;
  showDraftCollections: boolean;
};

export function PlaylistsManagerToolbar({
  createDescription,
  createName,
  createSlug,
  draftCount,
  embedded,
  isPending,
  missingFamilyCount,
  missingModelCount,
  onCreateDescriptionChange,
  onCreateNameChange,
  onCreateSlugChange,
  onCreateSubmit,
  onCreateMissingFamilyPlaylists,
  onCreateMissingModelPlaylists,
  onSeedAllFamilyPlaylists,
  onSeedAllModelPlaylists,
  onToggleCreateForm,
  onToggleDraftCollections,
  showCreateForm,
  showDraftCollections,
}: PlaylistsManagerToolbarProps) {
  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        {!embedded ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Admin</p>
            <h1 className="text-3xl font-semibold text-text-primary">Collections curation</h1>
            <p className="max-w-3xl text-sm text-text-secondary">
              Keep the runtime surfaces stable while preparing family playlists. The main examples hub stays on <code>examples</code>,
              guest starter stays on <code>welcome</code>, and family pages can be seeded from the current live order before you
              start reordering them.
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onToggleDraftCollections}>
            {showDraftCollections ? 'Hide draft / empty' : `Show draft / empty (${draftCount})`}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCreateMissingFamilyPlaylists}>
            {missingFamilyCount > 0 ? `Create missing family playlists (${missingFamilyCount})` : 'Sync family playlists'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCreateMissingModelPlaylists}>
            {missingModelCount > 0 ? `Create missing model playlists (${missingModelCount})` : 'Sync model playlists'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onSeedAllFamilyPlaylists}>
            Seed all family playlists
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onSeedAllModelPlaylists}>
            Seed all model playlists
          </Button>
          <Button type="button" size="sm" onClick={onToggleCreateForm}>
            {showCreateForm ? 'Close new collection' : '+ New collection'}
          </Button>
        </div>
      </header>

      {showCreateForm ? (
        <PlaylistCreateForm
          createDescription={createDescription}
          createName={createName}
          createSlug={createSlug}
          isPending={isPending}
          onCancel={onToggleCreateForm}
          onDescriptionChange={onCreateDescriptionChange}
          onNameChange={(nextName) => {
            onCreateNameChange(nextName);
            if (!createSlug.trim()) {
              onCreateSlugChange(slugify(nextName));
            }
          }}
          onSlugChange={(value) => onCreateSlugChange(slugify(value))}
          onSubmit={onCreateSubmit}
        />
      ) : null}
    </>
  );
}
