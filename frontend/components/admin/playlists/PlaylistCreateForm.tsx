import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';

type PlaylistCreateFormProps = {
  createDescription: string;
  createName: string;
  createSlug: string;
  isPending: boolean;
  onCancel: () => void;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function PlaylistCreateForm({
  createDescription,
  createName,
  createSlug,
  isPending,
  onCancel,
  onDescriptionChange,
  onNameChange,
  onSlugChange,
  onSubmit,
}: PlaylistCreateFormProps) {
  return (
    <section className="rounded-card border border-border bg-surface p-5 shadow-card">
      <form className="grid gap-3 lg:grid-cols-[1.2fr_1fr_minmax(0,1.5fr)_auto]" onSubmit={onSubmit}>
        <label className="text-sm">
          <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Name</span>
          <input
            type="text"
            value={createName}
            onChange={(event) => onNameChange(event.target.value)}
            className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Homepage holiday edits"
          />
        </label>
        <label className="text-sm">
          <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Slug</span>
          <input
            type="text"
            value={createSlug}
            onChange={(event) => onSlugChange(event.target.value)}
            className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="homepage-holiday-edits"
          />
        </label>
        <label className="text-sm">
          <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Description</span>
          <input
            type="text"
            value={createDescription}
            onChange={(event) => onDescriptionChange(event.target.value)}
            className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Optional internal note"
          />
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm" disabled={isPending || !createName.trim() || !createSlug.trim()}>
            Create
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
