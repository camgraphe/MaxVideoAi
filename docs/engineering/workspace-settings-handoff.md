# Workspace settings handoff

Reviewed 2026-10-30. Settings restoration and current pricing are separate concerns.

## Entry owners

| Entry | Source of settings | Owner |
| --- | --- | --- |
| Marketing model/workflow link | Explicit engine, mode, operation and optional media identity | `workspace-hydration.ts`, `useWorkspaceEngineModeState.ts` |
| Personal Gallery Rail card | Complete recorded job snapshot when present, then authenticated job detail | `workspace-render-groups.ts`, `useWorkspaceGalleryActions.ts`, `useWorkspaceVideoSettings.ts` |
| Curated Gallery Rail card | Lightweight mode/operation metadata, then the selected public recipe from `/api/videos/:id` | Curated feed projections and the same gallery/settings hooks |
| Public example/watch link (`from`) | Public recreation snapshot, authored keyframe recipe, or measured metadata fallback | `workspace-shared-video-snapshot.ts`, `useWorkspaceVideoSettings.ts` |
| Exact comparison link (`from` + `remix`) | Explicit supported target scenario | `workspace-example-recreation.ts` |

The private job endpoint remains owner-only. A signed-in visitor selecting a
curated card must use the public recipe endpoint, just like a guest. Whole feeds
carry mode and operation without loading every recipe or its references.

## Restoration rules

- A model link selects its engine once after account/draft hydration. It must not
  repin that engine after a gallery recall, manual choice or catalog revalidation.
  Workflow intent also includes mode, operation and media identity, so selecting
  another card can apply again without replaying incidental query changes.
- Preserve complete personal snapshots through group-to-tile projection. Do not
  replace a saved Modify/Extend recipe with a text-to-video display summary.
- Resolve operation capabilities before validating controls and binding typed
  references. Kling Reference/Edit and H3 Recast/Relight share a mode but differ
  in source fields and source-derived framing/timing.
- A recalled generation replaces creative settings. Missing legacy values use
  the target model defaults; explicit nulls clear old seeds, CFG and references.
  Unrelated draft values must not leak into the recalled setup. A complete recall
  also invalidates that model's parked source history before changing the draft;
  a later mode change or reload cannot reattach an abandoned input. A failed
  storage invalidation leaves the previous setup intact. Ordinary active-draft
  and remembered-preview hydration retain the existing per-mode history.
- Returning to a parked Create setup retains its available recorded mode before
  schema reconciliation. In particular, a recalled two-frame recipe may use
  canonical `first_frame_url`; inferring image-to-video would discard that input.
- Public recipes never import private source job/output bindings. Luma Extend
  and Flux Draft Enhance still require an eligible personal source selection.
  Personal recall retains its original owned-source identity.
- Public recipe references receive new account-owned identities before a quote
  can start. The selected `publicVideoId` goes to `/api/media-library/ensure`;
  `marketing-media/import-reference.ts` checks exact ready/public manifest
  membership and copied bytes, or the exact server-approved authored keyframe
  recipe. It uses the bounded, DNS-pinned downloader and measured upload owners,
  then verifies the persisted canonical facts. Legacy personal input URLs and
  client measurements cannot authorize this import.
- Public reference preparation keeps recall pending. Failure offers an explicit
  source replacement; guests receive sign-in guidance and retain `from` in the
  login return URL, including a Gallery Rail selection. Successful measured
  import consumes that intent. Later edits/selections cancel it, and old-account
  responses cannot attach references to a new account.
- The delayed detail response belongs to the selecting action and draft
  revision. A later edit, mode change, card selection or account change wins.
  Refine retains its prompt suffix when full details replace a card excerpt.
- A card without a complete snapshot keeps the last committed draft intact while
  its detail request is pending. Pricing and generation (including Seedance Draft)
  wait for restoration; the composer and rail remain editable. Failed or missing
  details expose a scoped error and keep generation blocked until another card
  is restored or the user changes the draft. Reloading retains the prior valid
  draft rather than persisting guessed text-to-video defaults. Complete inline
  snapshots remain immediately usable during optional detail enrichment.
- Original input media is restored separately from generated outputs and their
  display derivatives. Selecting a result does not make it a source attachment.
- Archived/unavailable models retain the existing explicit refusal behavior;
  restoration must not silently choose a different model.

Marketing publications retain `operation` when copied. For earlier copies that
omitted it, the public reader can recover only a validated enum from matching
private engine/mode provenance. It exposes no private references and writes no
database rows. See [marketing media](marketing-media.md).

## Price ownership

Restoration imports creative settings, never the old price or pricing receipt.
The composer builds a fresh preflight request from the restored mode, operation,
controls and original inputs; `useWorkspacePreflightQuote` obtains the current
canonical quote after required public reference imports are measured and ready.
Public example prices remain with `current-example-price.ts`
and update when current tariffs change. A missing current quote never falls back
to an old charge. The original-cost caption on personal history remains historical;
curated rail cards do not display it as a recreation price.

See [pricing engine](pricing-engine.md). No tariff, billing record, wallet or
pricing formula is changed by the handoff fixes.

## Regression coverage

- `workspace-gallery-recall-integration-dom.test.ts`: real gallery, draft,
  composer, settings and schema owners across personal/active/curated recalls,
  eight model-operation cases, scoped pending/failure gates, preservation of the
  committed draft, stale-response rejection and preflight inputs.
- `workspace-gallery-recall-browser.test.ts`: real Composer/settings with
  delayed public and personal detail reads on Chromium/WebKit, mobile/desktop.
- `workspace-requested-workflow-dom.test.ts`: link precedence, catalog refresh,
  same-engine workflow navigation and advanced-control reset.
- `workspace-video-settings.test.ts`: operation schemas, defaults, complete
  snapshots, legacy mode metadata and public/private source boundaries.
- `curated-workflow-recall-route.test.ts`, `model-demo-generation-mode-postgres.test.ts`
  and `marketing-media-public-read.test.ts`: real routes/SQL, safe publication
  recovery and lightweight feed metadata.
- `current-example-price.test.ts`: current price increases/decreases and refusal
  to reuse historical charges; existing preflight/quote tests retain live pricing.
- `public-recipe-reference-import.test.ts`: public approval, bounded transport,
  measured owned persistence and media-aware preflight, including revoked sources
  and stale stored metadata; gallery DOM/browser tests cover delayed preparation,
  auth return and cancellation.

Browser fixtures use synthetic media and do not submit paid generations. They
verify restoration, not provider execution or the availability of every historical
input URL. Missing original references require explicit replacement.
