"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { usePlacementEditor } from "./usePlacementEditor";
import { PlacementMediaList } from "./PlacementMediaList";

type Props = {
  playlistId: string;
  onStateChange?: (state: { dirty: boolean; busy: boolean }) => void;
};
export function PlacementEditor({ playlistId, onStateChange }: Props) {
  const state = usePlacementEditor(playlistId, onStateChange);
  const [search, setSearch] = useState("");
  const { loaded, draft, busy, dirty, change, preview } = state;
  const ordered = draft.orderedIds.flatMap(
    (id) => loaded?.candidates.find((item) => item.id === id) ?? [],
  );
  const available = (loaded?.candidates ?? []).filter(
    (item) =>
      !draft.orderedIds.includes(item.id) &&
      !draft.excludedIds.includes(item.id),
  );
  const matched = available.filter((item) =>
    `${item.id} ${item.engineLabel} ${item.prompt}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const exclude = (id: string) =>
    change({
      ...draft,
      orderedIds: draft.orderedIds.filter((value) => value !== id),
      excludedIds: [...draft.excludedIds, id],
    });
  if (!loaded)
    return (
      <div>
        <p role="status">{state.error ?? "Loading page contents…"}</p>
        {state.error ? (
          <Button onClick={state.reload} disabled={busy}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  if (!loaded.snapshot.available || !loaded.snapshot.supported)
    return (
      <p className="text-sm text-text-secondary">
        The page selection editor is not available for this destination.
      </p>
    );
  return (
    <div className="space-y-5">
      {!loaded.snapshot.config ? (
        <p className="text-sm text-text-secondary">
          Existing selection is active. Preview and save to choose how this page
          is filled.
        </p>
      ) : null}
      {loaded.removedCount ? (
        <p className="text-sm text-warning">
          {loaded.removedCount} saved items are no longer eligible and are
          hidden. Your next save will remove them from the selection.
        </p>
      ) : null}
      {!loaded.snapshot.isPublic ? (
        <p className="text-sm text-warning">
          This collection is private. Its public page will remain empty.
        </p>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-sm">
          Page order
          <select
            aria-label="Page order"
            value={draft.mode}
            disabled={busy}
            onChange={(event) => {
              const mode = event.target.value as "manual" | "hybrid";
              change({
                ...draft,
                mode,
                orderedIds:
                  mode === "manual"
                    ? state.items.map((item) => item.id)
                    : draft.orderedIds,
              });
            }}
            className="ml-3 rounded-md border border-border px-3 py-2"
          >
            <option value="manual">Manual order</option>
            <option value="hybrid">Featured + Automatic</option>
          </select>
        </label>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (
                !dirty ||
                window.confirm(
                  "Discard unsaved changes and reload this destination?",
                )
              )
                void state.reload();
            }}
          >
            Reload
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !dirty}
            onClick={state.cancel}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={
              busy ||
              (!dirty &&
                !loaded.removedCount &&
                Boolean(loaded.snapshot.config))
            }
            onClick={state.makePreview}
          >
            Preview changes
          </Button>
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        {draft.mode === "hybrid"
          ? "Featured videos stay first in your chosen order. Other eligible published videos follow by creation date, newest first."
          : "Only the selected videos appear, in your chosen order. New publications are offered below."}{" "}
        {dirty ? "Unsaved changes." : ""}
      </p>
      {state.error ? (
        <p role="alert" className="text-sm text-error">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm text-success">
          {state.message}
        </p>
      ) : null}
      <section aria-label="Selected media">
        <h3 className="text-sm font-semibold">
          {draft.mode === "hybrid" ? "Featured" : "Manual selection"} ·{" "}
          {ordered.length}
        </h3>
        <PlacementMediaList
          items={ordered}
          busy={busy}
          onOrder={(orderedIds) => change({ ...draft, orderedIds })}
          onRemove={(id) =>
            change({
              ...draft,
              orderedIds: draft.orderedIds.filter((value) => value !== id),
            })
          }
          removeLabel={draft.mode === "hybrid" ? "Unfeature" : "Remove"}
          onExclude={exclude}
        />
        {!ordered.length ? (
          <p className="py-4 text-sm text-text-muted">
            No videos selected. Add eligible media below.
          </p>
        ) : null}
      </section>
      <section
        className="border-t border-border pt-4"
        aria-label="Eligible media"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">
            {draft.mode === "hybrid" ? "Automatic" : "Available to add"} ·{" "}
            {available.length}
          </h3>
          <input
            aria-label="Search eligible media"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search videos…"
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Published videos matching this destination. Adding or excluding a
          video here does not change its publication status.
        </p>
        <PlacementMediaList
          items={matched.slice(0, 100)}
          busy={busy}
          onAdd={(id) =>
            change({ ...draft, orderedIds: [...draft.orderedIds, id] })
          }
          onExclude={exclude}
        />
        {matched.length > 100 ? (
          <p className="text-xs text-text-muted">
            Showing the first 100 matches. Search to find another video.
          </p>
        ) : null}
      </section>
      <details className="border-t border-border pt-4">
        <summary className="cursor-pointer text-sm">
          Excluded from this page · {draft.excludedIds.length}
        </summary>
        <ul className="mt-3 space-y-2">
          {draft.excludedIds.map((id) => (
            <li key={id} className="flex justify-between gap-3 text-sm">
              <span className="truncate">
                {loaded.candidates.find((item) => item.id === id)?.prompt ?? id}
              </span>
              <button
                disabled={busy}
                onClick={() =>
                  change({
                    ...draft,
                    excludedIds: draft.excludedIds.filter(
                      (value) => value !== id,
                    ),
                  })
                }
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      </details>
      {preview ? (
        <section
          aria-label="Page preview"
          className="border-t-2 border-brand pt-4"
        >
          <h3 className="text-sm font-semibold">
            Page preview · {preview.items.length} videos
          </h3>
          <p className="my-2 text-xs text-text-secondary">
            {draft.mode === "manual" ? "Manual order" : "Featured + Automatic"}.
            This selection takes effect after saving. New publications may
            extend automatic results.
          </p>
          <ol className="max-h-64 overflow-auto text-sm">
            {preview.items.map((item, index) => (
              <li key={item.id} className="truncate py-1">
                {index + 1}. {item.prompt || item.id}
              </li>
            ))}
          </ol>
          <Button
            className="mt-3"
            size="sm"
            disabled={busy}
            onClick={state.save}
          >
            Save changes
          </Button>
        </section>
      ) : null}
    </div>
  );
}
