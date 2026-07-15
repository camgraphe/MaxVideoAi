# Comparison Localized Content Organization Design

**Date:** 2026-07-15
**Status:** Implemented; final metadata-ownership clarification applied
**Scope:** Localized editorial overrides for comparison detail pages

## Context

Comparison detail pages currently load enriched editorial content from three route-local TypeScript files:

- `compare-page-overrides-en.ts`: 2,839 physical lines
- `compare-page-overrides-fr.ts`: 2,756 physical lines
- `compare-page-overrides-es.ts`: 2,756 physical lines

Each file owns the same 47 comparison slugs. The key sets are already identical across English, French, and Spanish, but a change to one comparison is spread across three large files. The current organization makes cross-locale review harder and lets future edits drift structurally unless a test happens to cover the affected comparison.

The audit also found a bounded pre-existing enrichment gap: 13 comparison slugs have explicit English metadata that is absent from both localized override maps, and one of those slugs also lacks the localized quick verdict. French and Spanish currently use their generic localized comparison output for those fields; they do not display English fallback copy.

The project therefore has two deliberately separated phases: first complete those known localized enrichment fields, then perform the behavior-preserving content-organization refactor. The existing locale-switching and middleware architecture remains the single owner of public locale selection and is outside this scope.

## Goals

1. Complete the 13 known FR/ES metadata gaps and the one known FR/ES quick-verdict gap without changing routes or product facts.
2. Make one comparison the unit of ownership and review.
3. Keep English, French, and Spanish adjacent in one content file.
4. Make incomplete or structurally divergent localized enrichment fail before deployment.
5. Preserve the existing public loader contract and every rendered result after the explicit parity additions.
6. Delete the three large locale-specific TypeScript sources after a proven mechanical migration.
7. Avoid adding a CMS, database table, generated registry, compatibility fallback, or generic content framework.
8. Give every canonical comparison slug exactly one metadata owner: its enriched JSON document,
   when present, or the locale-message SEO fallback for a generic comparison without a document.

## Non-goals

- Rewriting, polishing, or expanding existing comparison copy beyond the explicitly missing FR/ES metadata and quick verdict.
- Requiring enriched override content for comparison pages that currently use the generic renderer.
- Changing public URLs, localized route segments, redirects, canonicals, hreflang, robots, sitemap membership, metadata infrastructure, FAQ schema, or JSON-LD. Only the enumerated missing localized metadata values are added.
- Changing comparison publication policy, engine/model configuration, pricing, scorecards, specs, showdowns, or media.
- Moving model-page decision copy in the same batch. Model content organization will be a separate project.
- Adding an admin editor or runtime persistence for editorial content.
- Changing any route, slug, redirect, canonical, hreflang, sitemap rule, publication rule, price, model fact, score, spec, showdown, media item, or existing internal link.

## Current Inventory

- 47 enriched comparison slugs.
- 3 required locales: `en`, `fr`, and `es`.
- 141 slug-locale projections. Phase A changes only the enumerated missing localized fields; Phase B preserves the completed projections exactly.
- The current consumer API is `getComparePageOverride(locale, slug)` from `compare-page-overrides.ts`.
- Comparison pages without an override intentionally fall through to the existing generic comparison content.
- Locale message files may retain `compareCopy.meta.slugOverrides` only for generic comparisons
  without a content document. Their slug sets must remain disjoint from the discovered JSON inventory.

### Known localized enrichment gaps

Both FR and ES lack an explicit `meta` object for these 13 enriched slugs:

- `seedance-2-0-vs-seedance-2-0-fast`
- `dreamina-seedance-2-0-mini-vs-seedance-2-0`
- `dreamina-seedance-2-0-mini-vs-seedance-2-0-fast`
- `dreamina-seedance-2-0-mini-vs-ltx-2-3-fast`
- `dreamina-seedance-2-0-mini-vs-veo-3-1-fast`
- `dreamina-seedance-2-0-mini-vs-luma-ray-3-2`
- `luma-ray-3-2-vs-veo-3-1-fast`
- `happy-horse-1-1-vs-kling-o3-pro`
- `happy-horse-1-1-vs-veo-3-1-fast`
- `happy-horse-1-1-vs-seedance-2-0-fast`
- `dreamina-seedance-2-0-mini-vs-happy-horse-1-1`
- `happy-horse-1-1-vs-ltx-2-3-pro`
- `veo-3-1-fast-vs-veo-3-1-lite`

For each localized projection, the new metadata must add a natural localized `title`, `description`, and the same `titleBranding` policy as English. Titles must remain within 35–80 characters and descriptions within 120–180 characters.

FR and ES also lack `quickVerdict.title` and `quickVerdict.body` for `seedance-2-0-vs-seedance-2-0-fast`. Those two localized verdicts must preserve the English facts and decision intent while reading naturally in French and neutral LATAM Spanish.

## Target Content Shape

Create one JSON document per enriched comparison:

```text
content/comparisons/
  seedance-1-5-pro-vs-seedance-2-0.json
  seedance-2-0-vs-seedance-2-0-fast.json
  ...
```

Each document has exactly one comparison identity and all three locale projections:

```json
{
  "slug": "seedance-2-0-vs-seedance-2-0-fast",
  "en": {
    "meta": {},
    "heroIntro": "..."
  },
  "fr": {
    "meta": {},
    "heroIntro": "..."
  },
  "es": {
    "meta": {},
    "heroIntro": "..."
  }
}
```

The locale values use the existing `ComparePageOverride` contract. Existing optional fields remain optional; the refactor must not manufacture fields that are absent today.

The filename stem and internal `slug` must match exactly. Slugs must use the existing canonical comparison-slug vocabulary and a path-safe lowercase slug format.

## Runtime Architecture

`compare-page-overrides.ts` remains the only public owner of:

```ts
getComparePageOverride(locale: AppLocale, slug: string): ComparePageOverride | undefined
```

The module becomes the direct, server-only JSON loader and validator. It resolves a canonical, path-safe slug to `content/comparisons/<slug>.json`, parses the file, validates the complete document, and returns the requested locale projection.

No additional facade, generated manifest, registry, cache service, or fallback adapter is introduced. The existing `compare-page-overrides-types.ts` remains the type owner. Validation helpers may stay private in the loader as long as the module remains focused and readable.

Consumer behavior is unchanged:

- no content file: return `undefined`, preserving the generic comparison renderer; the metadata
  builder may separately use the existing locale-message SEO fallback for that generic comparison;
- valid content file: return the exact requested locale object;
- present but invalid content file: throw an error that identifies the file and failing field;
- present content file missing `en`, `fr`, or `es`: throw; never fall back to English.

The no-English-fallback rule applies to enriched content files. It does not force currently generic comparison pages to gain new editorial overrides.

## Deployment Boundary

The loader uses the repository content directory as a server-only source. `frontend/next.config.js` must include `../content/comparisons/**/*` in the existing `CONTENT_GLOBS`, alongside `content/models`, so traced Vercel functions receive every JSON document.

Routes and client components must not import JSON files directly. The public comparison route continues to depend on the existing `getComparePageOverride` API, keeping filesystem access outside client bundles.

## Validation Rules

Every discovered JSON document must satisfy all of these rules:

1. It is valid JSON and a plain object.
2. It contains only the supported top-level identity and locale keys.
3. `slug` is non-empty, path-safe, and equals the filename stem.
4. `en`, `fr`, and `es` are all present.
5. Each locale value conforms to the existing `ComparePageOverride` vocabulary.
6. After the explicit parity phase, the three locale objects have equivalent structural field presence. Localized array lengths and prose remain editorial values, but a field family present in one locale cannot be silently absent from another.
7. Required metadata, card, link, verdict, and FAQ values are correctly typed when present.
8. Internal links preserve their existing hrefs and resolve only through supported public route families. Locale-neutral `/models`, `/examples`, `/ai-video-engines`, and `/pricing` paths remain valid in every projection; FR may also use `/fr/modeles`, `/fr/exemples`, `/fr/comparatif`, and `/fr/tarifs`; ES may also use `/es/modelos`, `/es/ejemplos`, `/es/comparativa`, and `/es/precios`. Cross-locale FR/ES prefixes fail validation.
9. Unknown fields fail validation instead of being silently ignored.
10. Duplicate slugs or files whose internal identity differs from their filename fail validation.

The validator must model the existing contract rather than normalize array lengths, reorder content, or rewrite optional editorial values to satisfy a newly invented shape. Phase A removes the known field-family gaps before strict structural validation becomes permanent.

## Migration Strategy

### Phase A: localized enrichment parity

This phase is an intentional, bounded content change and must be reviewed independently from file movement.

1. Add the missing FR and ES `meta` objects for the 13 enumerated slugs.
2. Add the missing FR and ES quick verdict for `seedance-2-0-vs-seedance-2-0-fast`.
3. Adapt the English intent into natural French and neutral LATAM Spanish; do not translate mechanically or introduce new product claims.
4. Preserve every route, link, card, FAQ, price, model fact, schema field, and publication decision outside those missing fields.
5. Run localized SEO length, uniqueness, vocabulary, fact, route, metadata, and rendering tests.
6. Commit and review this content-only delta before the structural migration starts.

### Phase B: mechanical JSON migration

After Phase A, the migration is mechanical and must not change prose.

1. Record the current 47 slug keys for each locale and prove exact key and structural parity.
2. Load the three completed TypeScript maps and serialize each slug into one JSON document containing `en`, `fr`, and `es`.
3. Preserve key presence, array order, string contents, link order, and optional-field absence exactly.
4. While both representations temporarily exist, deep-compare all 141 post-parity old and new projections.
5. Run focused route-data and SEO comparisons before deleting the old source files.
6. Switch `compare-page-overrides.ts` to the JSON loader.
7. Delete `compare-page-overrides-en.ts`, `compare-page-overrides-fr.ts`, and `compare-page-overrides-es.ts` in the same completed batch.
8. Delete the one-off converter and old/new comparison bridge. Neither belongs in the final architecture.

The implementation may use incremental commits for review, but the final branch must have one
source of truth for every enriched comparison. Metadata for a document-backed slug belongs to
that document; locale-message overrides remain only for generic comparisons without documents,
and the two slug inventories must have an empty intersection.

## SEO and Route Preservation

No route or SEO infrastructure changes. Phase A intentionally adds localized metadata for 13 slugs and a localized quick verdict for one slug. Apart from those enumerated additions, the project must preserve, byte-for-byte where the current builder exposes strings:

- all existing metadata titles, descriptions, and title-branding flags;
- hero introductions, verdicts, cards, FAQ copy, and link labels;
- internal link destinations and ordering;
- FAQ/JSON-LD inputs;
- canonical and hreflang generation;
- localized route segments (`/ai-video-engines`, `/fr/comparatif`, `/es/comparativa`);
- robots and comparison publication behavior;
- generic comparison fallback behavior when no enrichment file exists.

The route, metadata, schema, routing, publication, and sitemap modules are not migration targets.

## Permanent Test Contracts

Tests must discover `content/comparisons/*.json` dynamically rather than maintain a second manual slug list.

Permanent contracts must verify:

- exactly one valid identity per file;
- all discovered files contain `en`, `fr`, and `es`;
- locale structures satisfy the runtime contract;
- filename and internal slug match;
- links remain byte-identical, resolve to supported public route families, and never use a crossed FR/ES locale prefix;
- every file is reachable through `getComparePageOverride` for all three locales;
- each locale has an empty intersection between discovered document slugs and
  `compareCopy.meta.slugOverrides`, while generic message-only SEO fallbacks remain valid;
- a missing file still returns `undefined` for the generic renderer;
- malformed, incomplete, unknown-field, and path-unsafe fixtures are rejected;
- routes consume only `compare-page-overrides.ts` and never direct JSON files;
- the three obsolete locale-specific override modules do not exist;
- Next output tracing includes the comparison content directory.

Existing comparison enrichment, routing, localization, metadata, pricing-display, schema, and architecture tests remain required.

## One-time Migration Proof

Before the old maps are removed, a temporary verifier must prove deep equality for all 141 post-parity slug-locale projections. It must also compare representative route data for English, French, and Spanish and report zero differences between the completed TypeScript maps and JSON loader.

This full-text baseline is evidence for the migration only. It must not remain as a duplicate fixture after the old sources are removed. Permanent tests protect structure, loader behavior, links, and SEO projections without freezing a second copy of all editorial prose.

## Verification

The completed batch must run:

- focused comparison architecture, localization, routing, enrichment, metadata, schema, and pricing-display tests;
- the dynamic content validation suite;
- full `pnpm test:validate`;
- frontend lint;
- public exposure lint;
- frontend TypeScript;
- architecture audit;
- production frontend build;
- `git diff --check`;
- representative smoke checks for English, French, and Spanish comparison URLs.

The final diff must show no changes to pricing sources, model registries, comparison publication configuration, localized slug configuration, sitemap policy, or route components. Authored prose changes are restricted to the enumerated Phase A FR/ES metadata and quick-verdict additions; Phase B is relocation only.

## Acceptance Criteria

- 47 JSON files are the only enriched comparison-content source and own the metadata of every
  document-backed slug.
- Every file owns exactly one slug and all three locales.
- Phase A adds only the enumerated FR/ES metadata and quick-verdict fields and passes localized editorial/SEO review.
- All 141 Phase B projections are proven identical to the completed post-parity maps.
- `getComparePageOverride(locale, slug)` retains its signature and observable behavior.
- Generic comparisons remain generic.
- Generic comparisons without documents may retain localized message metadata fallbacks; no slug
  may be owned by both a document and `compareCopy.meta.slugOverrides`.
- Missing locales and malformed enriched files fail before deployment.
- No automatic English fallback exists for enriched content.
- The three giant locale TypeScript files and temporary migration logic are deleted.
- Public routes are unchanged; SEO output changes only through the enumerated localized enrichment additions.
- All focused and full verification gates pass.

## Follow-up Boundary

Model-page decision-copy organization is intentionally deferred. It requires reconciling the existing TypeScript decision-copy maps with the separate `content/models/{locale}/{slug}.json` schema and deserves its own design, migration proof, and regression plan.
