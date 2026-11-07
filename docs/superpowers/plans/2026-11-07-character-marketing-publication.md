# Character marketing publication implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development for scoped implementation and independent review. The user has authorized execution and production publication; do not ask again for implementation choices. Paid generation still requires a fresh exact quote and separate approval.

**Goal:** Publish the existing approved Dixie and Vesper films independently in production and prepare one real Recast canary for exact-price approval.

**Architecture:** Add a bounded admin import of an exported public marketing publication. Reuse snapshot sanitation, exact-byte copying, per-publication leases and public readers; create no personal jobs/assets or billing records. Import first as private, then activate using existing visibility and playlist controls.

**Tech Stack:** Next.js, TypeScript, PostgreSQL 17, existing S3 copy transport and admin session.

**Spec:** Existing operational design `output/character-studio-v2/release-2026-11-07/dixie-vesper-publication-plan.md` and `docs/engineering/marketing-media.md`.

## Global constraints

- Source IDs: Dixie `5833eee1-6c61-451c-a455-a5b08716cffc`; Vesper `b95c603e-2339-440e-b50e-7b7b2757da3c`.
- Preserve the approved Vesper music/no-voice-over delivery, not its previous voiced original or stale preview.
- Production copies get new namespaces; source personal jobs, assets, accounts, wallets and source publications remain unchanged.
- Only public portable HTTPS marketing-media URLs, no credentials, signed queries or private provenance in input manifests. Source metadata export is read-only from the test database; user authorizes transfer of these two already-approved publications and their reference recipes.
- 64 required files, 256 MiB/file, 512 MiB/publication, 180-second preparation deadline. Verify MIME, size, SHA-256, public HEAD/206 and exact required manifest closure. Ignore extra historical files which the selected publication no longer uses.
- Existing ready/tombstoned/deleting publications cannot be overwritten. Retry same incomplete import only; leases and fingerprints fence attempts. All storage and DB mutations are limited to marketing-media.
- No source secrets copied into production. Admin import uses the existing logged-in administrator, not a new service credential.
- Normal PR, selected Quality CI, exact Git Preview gate, fresh-main production alignment and automatic Git deployment; no manual deploy or bypass.

## Review focus

- Stale Vesper original/preview: selected published video must remain authoritative.
- Imported metadata with hidden private bindings or missing nested references: sanitation and exact manifest closure before copying.
- Double submission, stale attempt, ready collision and tombstone: no duplicate/overwritten publication.
- Source bytes changed or copied bytes missing: fail without activation; no personal writes.
- Import error and repeat UI clicks: clear feedback, in-flight controls disabled, no automatic generation or publication.

### Task 1: Public publication importer and evidence tests

**Files:** Create `frontend/server/marketing-media/import-publication.ts`, optional small adjacent contract helper, `tests/marketing-media-import.test.ts`, `tests/marketing-media-import-postgres.test.ts`; update `docs/engineering/marketing-media.md`.

**Interfaces:** Export `importMarketingPublication({manifest: unknown, actorId: string, permissionConfirmed: boolean}, dependencies?)` returning the existing MarketingMediaItem. Export `previewMarketingPublicationImport(manifest: unknown)` as a pure validated summary if useful. Manifest schema `maxvideoai-marketing-publication/v1` contains `source` (public page URL and export time), `publication` (public DTO), `recreationSnapshot` (public recipe), and `files` (`url`, `mime`, `sizeBytes`, `sha256` only). Require matching publication and recipe engine/settings. Imported publication starts private and non-indexable. Preserve only public provenance in source_record/source_snapshot; no source account IDs. The caller must authenticate admin before invoking.

- [ ] Write failing tests for import closure, changed bytes, missing references, private bindings, unsupported URL/query, stale Vesper extras, permission and size limits.
- [ ] Implement validation using prepareMarketingSnapshot/completeMarketingSnapshot and shared sanitation; reuse copyMarketingMediaFile and compare expected hashes/sizes/MIME. Keep imported-source write orchestration separate from original-job promotion.
- [ ] Exercise real PostgreSQL import, idempotency, live lease, changed manifest, ready collision, tombstone and failed import retry. Assert no writes to personal/billing tables and fresh independent copy namespace.
- [ ] Run focused tests, type-check, review diff and commit only owned files. No remote operations.

### Task 2: Admin import surface and publication refresh

**Files:** Create `frontend/app/api/admin/marketing-media/import/route.ts`, small colocated admin import component; modify MarketingMediaLibrary.client.tsx; add focused HTTP/UI tests and scoped refresh helper if needed.

**Interfaces:** POST JSON `{manifest, permissionConfirmed}` invokes Task 1 only after requireAdmin and marketing gate. Bound body to 2 MiB. Return existing `{ok,item}` shape. UI is an explicit Import publication disclosure with local JSON chooser, permission checkbox, error/status feedback and existing list refresh after success. No automatic public activation. A read-only preview displays identity, duration, resolution and required file count before import.

- [ ] Add failing auth/body/invalid-manifest tests and UI file/permission/in-flight test.
- [ ] Implement bounded route and import UI without new credentials or native popup.
- [ ] Ensure authorized publication changes invalidate affected home, Character landing, Examples and Character blog locale paths through the existing revalidation owner; no false source-code change just to refresh caches.
- [ ] Run focused route/UI and existing marketing tests; commit owned files.

### Task 3: Publish and qualify existing films; prepare canary

- [ ] Export only the two ready public source DTOs and used files after a fresh bounded source read; confirm selected Vesper video hash and preserve approved audio.
- [ ] Complete independent review and normal delivery gates on current main.
- [ ] Import both files through admin; verify independent target namespaces, exact bytes, complete references and no personal/job/payment changes.
- [ ] Publish both copies and attach to public `character-studio-recast` playlist via supported admin controls.
- [ ] Check public API, HEAD/Range, localized home/landing/blog/Examples, manual playback, audio, seek/end and zero original requests before Play on desktop/mobile.
- [ ] Prepare a meaningful short Recast with owned character/reference(s), show scene and independent source passages, resolution, exact quote/expiry. Wait for explicit approval before any paid attempt.

## Execution rulings

- The user said “go” after the explicit remaining-work list, which authorizes implementation and independent production publication. No further design-choice approval is needed.
- The source Preview application is Vercel-protected. Export its public DTOs with bounded database reads; source eligibility is rechecked operationally immediately before import and activation. Do not transfer a protection-bypass secret. The importer validates a portable authorized snapshot and immutable bytes, not a remote Preview session.
