# Video discovery release

This runbook prepares PR 363 (`codex/video-discovery`). It does not authorize a
production merge, migration or collection mutation. Use the GitHub → main → Vercel
Git delivery process in [github-vercel.md](github-vercel.md).

## Release gates

1. Fetch `origin/main`, run `pnpm deployment:check`, and confirm the candidate includes
   current main. Both production domains must still resolve to the same validated
   Git deployment.
2. Require Quality CI and Vercel Preview success on the proposed PR head. Review the
   exact diff since the last approved application build.
3. Accept the comparable CWV report for hub, Wan family, landscape watch page and
   portrait watch page, desktop/mobile, cold/warm. The report must identify both
   commits, build IDs and the immutable fixture hash. Preview readiness and older
   Lighthouse results do not close this gate.
4. Preserve the approved watch sitemap, canonical URLs, original media URLs and
   VideoObject fields. Do not publish additional videos as part of this release.
5. Obtain explicit production release authorization after presenting these results.

## Rehearse without production access

From the repository root:

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/gallery-release-rehearsal-postgres.test.ts \
  tests/admin-playlist-curation-postgres.test.ts \
  tests/admin-curation-effective-preview-postgres.test.ts \
  tests/examples-catalog-pagination-postgres.test.ts
```

These tests replace `DATABASE_URL` with a socket-only disposable PostgreSQL database.
They replay migration 53, call the actual missing-model-collection helper twice, and
compare stored records and public projections. No production fixture is required.

## Schema preparation: migration 53

The latest read-only inventory, captured 2026-09-29 23:40 UTC, finds
`playlist_curations` present and `opening_ids` absent. Recheck at release time:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'playlist_curations'
ORDER BY ordinal_position;

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = to_regclass('public.playlist_curations');
```

If migration 52 is absent or the existing column/constraint has an unexpected shape,
stop and reconcile the schema. Migration 53 assumes migration 52 is installed. The
new column is nullable: existing selections keep their public order and fallback
behavior. Four explicit opening slots become writable only after schema preparation.

After release authorization, use the normal Neon migration connection. In `psql`,
from the repository root, apply the **existing authored migration file** in a bounded
transaction; enable `ON_ERROR_STOP` before executing:

```sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
\i neon/migrations/53_playlist_opening.sql
COMMIT;
```

This operation adds `opening_ids text[]` and `playlist_opening_four_slots`. It creates
no playlist, populates no opening and changes no publication, price or media. A lock
timeout aborts the transaction; investigate and retry deliberately. Do not raise the
timeout blindly. Confirm the column and named constraint after commit.

## Two missing editable model collections

The same inventory confirms these exact runtime destinations:

| Model | Collection slug | Existing model-page examples |
| --- | --- | ---: |
| Dreamina Seedance 2.0 Mini | `examples-dreamina-seedance-2-0-mini` | 5 |
| Happy Horse 1.1 | `examples-happy-horse-1-1` | 2 |

The videos already appear through authored editorial selections. Missing editable
collections do not mean missing model pages. Recheck the inventory before mutation;
if the missing list differs, review it instead of reusing this count.

After the authorized application release, in `/admin/playlists`, use the maintenance
action **Create missing model collections**. The authenticated helper
`create-missing-model-playlists` creates only absent published-model collections. It
preserves existing IDs, names, privacy, order and curation. Repeating the action finds
the existing rows rather than duplicating them.

Verify that both rows are public, empty and connected to their existing `/models/…`
destinations, and that no `playlist_curations` row was created for them. Creating an
empty collection keeps the existing editorial fallback. Saving an empty Manual
curation is a different action: it intentionally suppresses that fallback.

Do not use **seed all models**, rename collections or import an order for this
reconciliation. Later curation is a separate editor action: choose videos and formats,
inspect the effective preview and explicitly save. Family/hub inheritance can change
when an operator adopts curation; the preview must show the suppressed sources.

## After the Git deployment

- Confirm both production domains resolve to the merged main Git deployment with
  `pnpm deployment:check`.
- Smoke-test Examples pagination, family opening formats, direct watch page and popup
  navigation, initial paused state and first Play in both formats.
- Check a public **Use this prompt** handoff: full prompt, selected engine, duration,
  resolution, aspect and audio must appear in the composer. Do not submit a paid render
  as a smoke test.
- Check admin authentication and destination selection. On an existing curated
  destination, make a local draft change, preview it, then cancel; confirm the stored
  revision is unchanged. Do not save a smoke-test draft or an empty Manual collection.
  A real save belongs to the separately reviewed editorial adoption described above.
  Confirm an anonymous admin API call remains denied.
- Recheck approved sitemap URLs, canonical, robots and VideoObject output. Rankings,
  Google video classification and field Core Web Vitals require subsequent observation.

## Rollback

Use a reviewed Git revert through main to restore the previous application. Keep
migrations 52/53 and authored curation records: both are additive and legacy readers
ignore the new opening column. Do not drop the column, delete collections or restore
all playlists from a historical dump. A later operator save is independent data state;
diagnose it and use a reviewed per-destination preview before changing it.
