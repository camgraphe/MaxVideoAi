# Gallery curation workbench

Date: 2026-09-29

Branch: `codex/video-discovery`

Status: design approved in conversation for the compact workbench and SEO handoff; implementation pending written-spec review

## Intent and success

The admin must let an editor choose a site destination, see its actual video composition, place the four opening videos where supported, add and order the remainder, inspect a video, preview the effective public result, and save from one workspace. The editor should understand the available families and models without scrolling through the selected and candidate lists. The visual hierarchy should be media-first, compact, high contrast, and consistent with the existing light admin shell and indigo brand. One selector communicates the active destination; a separate introductory destination panel would repeat it and consume space needed by the videos.

Success means that at the current approximately 960-pixel browser width, the destination selector and opening videos appear near the top of the first viewport, without a verbose introduction or duplicate summary panel; the editor can find another family/model immediately; the candidate inventory no longer pushes destination navigation to the bottom; and every mutation still passes the existing draft, preview, revision, and eligibility checks. This is an admin interface change. Existing public routes, gallery pagination, watch pages, Video SEO publication rules, and model identities retain their current owners.

## Evidence and chosen approach

The current `/admin/playlists` page shows two large local collection warnings above the selected destination. At approximately 960 pixels wide, the app sidebar leaves about 710 pixels for content, so the `lg` two-column breakpoint does not apply. The family/model inventory consequently follows the long selected and candidate lists. Selected and candidate media appear as dense rows with 64 × 40 thumbnails, raw prompt text, and repeated action buttons. The four-video opening is controlled through text selects and sits after the save controls.

Three approaches were considered:

1. **Compact workbench, selected.** A persistent destination control, visual opening board, ordered card grid, contextual media explorer/inspector, and sticky draft actions keep the task in one route at this width.
2. Permanent split view. It exposes selected and candidate media simultaneously, but compresses both visual grids inside the current 710-pixel content area.
3. Step-by-step wizard. It reduces simultaneous controls but slows frequent switches among families and models and hides the gallery composition during candidate selection.

The user selected the compact workbench. The user also selected SEO status plus a direct link to the existing SEO editor, rather than inline SEO editing.

## Workspace layout and behavior

### Destination bar

The page begins with a short title, a compact diagnostic count, and one compact destination selector. Inside that control, show the current name and a short type/count line; keep the public-page link beside it. Do not add a separate destination summary card, a long explanatory paragraph, or a redundant group of family/model buttons above the opening videos. The searchable selector opens over the current page and groups Examples hub, Starter, families with nested models, image/audio, and maintenance entries. The full picker must be reachable at every width. The inventory must no longer rely on anchors to a list below the editor.

Search includes label, family, model slug, and public path. An existing destination is selected only after its detail request succeeds. Switching while dirty keeps the current confirmation/guard; pending actions lock switching. Missing and historical destinations remain visible with their precise status and a deliberate maintenance action. Selecting or viewing them never creates, renames, migrates, deletes, or publishes a collection. Local hub/starter slug drift is shown as a diagnostic, never silently reconciled.

### Gallery composition

For destinations with opening support, the first visual section is a four-slot board matching the public arrangement: one 16:9 lead, one 9:16 portrait, and two 16:9 side sources shown in their cropped side frames. Slot badges show position and required source format. Clicking a slot opens the media explorer already filtered to its required format. Existing opening IDs remain part of the first logical public page and are not duplicated in the continuation. An invalid, unavailable, or incomplete opening is visually identified and blocks preview by the existing validation rule. If optional opening storage is unavailable, the workbench explains that state and retains the supported legacy editing path.

The continuation is a responsive grid of video cards rather than rows. Cards use a stable frame but show a portrait source with its full 9:16 shape inside that frame; a 16:9 source is not mislabeled or stretched. The visible card surface favors poster, order number, concise engine/format metadata, and one clear inspect action. Repeated secondary actions move to the card menu or inspector. The grid remains bounded to the existing selected-ID hydration windows of 48, while the complete ordered-ID draft stays in memory. Global positions and page controls stay visible. Drag/drop, keyboard up/down, and a direct move-to-position action must preserve the full order across windows. Remove and exclude have distinct labels and effects.

### Media explorer and inspector

`Add videos` and opening-slot selection use one contextual explorer on the same route. On wide screens it docks beside the composition; at the current width it is a focus-managed drawer; on narrow mobile screens it becomes a full-width sheet. It contains the current destination, search, family/model and measured-format filters, exact-ID lookup in advanced options, candidate cards, total/page state, and cursor navigation. A slot request fixes the format filter. An already selected or excluded item cannot be added again. Candidate data remains server-filtered and cursor-paged in groups of at most 48; opening the page does not preload every candidate poster or video.

Clicking a selected card opens an inspector with a larger poster/player on explicit intent, prompt and engine details, measured dimensions, gallery membership, and clear remove/exclude actions. It lazily reads the video's actual editorial Video SEO state and sitemap eligibility from an authenticated read-only source, then links to `/admin/video-seo?video=<id>`. The label distinguishes public/gallery eligibility from SEO approval. No SEO mutation runs inside the workbench, and no status is inferred solely from a public or indexable flag. An unavailable SEO read shows an unavailable state and keeps the link.

### Draft, preview, and save

A compact persistent action bar shows `Saved`, `Unsaved changes`, `Preview ready`, or a blocking error. It contains mode selection, Cancel, Preview changes, and Save changes. Save remains disabled until a successful preview token for the current draft exists. The preview opens a focused summary with current versus proposed total, additions, removals, effective first 24 IDs, suppressed sources, opening formats, and warnings; it does not merely echo the raw draft. A large removal or empty effective result remains conspicuous.

The current transactional curation service owns eligibility, revision, preview token, and save. A 409 or failed save retains the draft, invalidates Save, and prompts a fresh preview. Cancel restores the last confirmed snapshot. A successful save updates the local snapshot before a potentially failing inventory refresh. Unsupported unconfigured collections keep the legacy manual editor. Maintenance controls remain available through a separate disclosure and are disabled while an order is dirty.

## Component and data boundaries

`PlaylistsManager` stays the state and route-level UI orchestrator. A focused destination navigator replaces the current long-inventory placement while reusing the existing destination projection and guarded selection action. `PlacementEditor` keeps its controller and composes focused opening board, selected grid, candidate explorer, media inspector, preview summary, and draft action components. The existing curation candidate endpoint, complete-ID draft, preview, and save contract remain authoritative. A small authenticated, read-only SEO detail endpoint or equivalent server adapter may expose the already-owned watch-page status for the inspector; it must not duplicate editorial logic or add a write path.

The public 24-item hub/family pages, model gallery readers, watch URLs, canonical/hreflang/JSON-LD, sitemap gates, and pricing logic are outside this UI ownership. The model registry remains the sole authored source for model identities and family grouping. The admin must not invent a separate model catalogue.

## Visual, responsive, and accessibility rules

Use the existing admin light shell, but give the work canvas a visibly distinct neutral surface, a single compact selector, raised white media cards, and restrained indigo actions. Let the media supply the visual weight rather than adding a large decorative header. Avoid long explanatory paragraphs before the first video. Keep labels concise, show full technical details only on demand, and reserve warning color for actions or states needing intervention. Status is expressed in text as well as color.

At 688 and approximately 960 pixels, the destination control precedes the editor in both visual and keyboard order. At 1440 pixels the explorer can dock without reducing the selected cards below usable width. At mobile widths the explorer and inspector fill the available viewport and restore focus to their opener on close. All menus, drawers, slot choices, pagination, reorder controls, preview, and save work without pointer drag. Escape closes a drawer without discarding the draft. Card posters are lazy below the fold, video sources use no eager preload, and simply opening the workbench does not animate dozens of previews.

## Validation

- Update the playlist architecture and destination UI contracts to lock the new navigator order and component boundaries. Preserve dirty-switch, legacy-editor, missing-destination, and projection-refresh behavior.
- Cover four slot formats and uniqueness, cross-window reorder, global move-to-position, candidate page three, filter cursor reset, duplicate prevention, exclude versus remove, and draft retention after preview/save rejection.
- Cover lazy SEO status read, direct SEO link, unavailable status, and the distinction between gallery eligibility and sitemap approval.
- Browser-check 688 × 900, the user's approximately 960-pixel viewport, 1440 × 1000, and mobile: first useful media, no horizontal overflow, keyboard/focus flow, drawer/sheet, preview/save, and missing diagnostics.
- Check the first load and first explicit Play separately; compare admin request counts and media transfer before and after. Public Core Web Vitals should not be claimed improved by an admin-only redesign.
- Run the focused playlist, curation, admin architecture, frontend type/lint, exposure lint, and `git diff --check` gates. Do not modify a production database or deploy during this work.

## Reviewable visual reference

The two conceptual mockups are attached to this spec as `assets/admin-curation-concept.png` and `assets/admin-curation-explorer.png`. Their media art and French labels illustrate layout only; implementation copy should stay consistent with the current admin language.
