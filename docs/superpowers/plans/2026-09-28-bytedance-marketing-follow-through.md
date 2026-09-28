# ByteDance Marketing Follow-Through Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align every public and acquisition surface with the verified BytePlus family, Draft workflow, capabilities and approved customer prices after the direct-provider and admin-pricing work is released.

**Architecture:** Audit first, then make localized, evidence-backed changes through the model registry and existing route/content owners. Canonical quotes remain the source of displayed prices; media and SEO follow their existing contracts. Publish only features that are live and tested.

**Tech Stack:** Next.js App Router, TypeScript, localized JSON/MDX content, `@maxvideoai/pricing`, Node tests with `tsx`, browser smoke.

**Spec:** `docs/superpowers/specs/2026-09-28-bytedance-direct-pricing-and-marketing-design.md`

## Global Constraints

- Start only after the ByteDance direct/Draft plan, the manual pricing-grid cutover and admin comparison have verified release results and approved customer prices, if any.
- Keep canonical model identity/publication in `frontend/config/model-registry.json`; regenerate projections, never hand-edit them.
- Do not promise Draft, Flash, authorized portraits, 4K Pro images, Seedance 1.5 availability beyond its published 2026-11-11 shutdown, or a price that the live product cannot deliver.
- Preserve public URLs, locale paths, canonical/hreflang, JSON-LD, historical examples and original media links.
- Read `docs/engineering/model-registry.md`, `page-architecture.md`, `media-delivery.md`, `pricing-engine.md`, and the relevant SEO/marketing architecture tests before editing.

## Review Focus

- Draft copy confused with the separate Fast/Mini models: explain the two-step Seedance 2.5 path accurately (Task 2 test).
- One locale has a capability or price missing from the others: EN/FR/ES parity check (Task 2 test).
- Pro image page advertises 4K although provider maximum is 2K: reject the claim (Task 2 test).
- JSON-LD or price cards show a stale amount after an approved policy change: exact canonical quote check (Task 2 test).
- Example video or poster does not load/first-play after promotion: browser and media check (Task 3 test).

---

### Task 1: Inventory and decision brief

**Files:**
- Create: `docs/marketing/bytedance-family-release-review.md` for a dated matrix of surface, current claim, verified capability, price source, action, locale, and publication gate.
- Test: read-only `pnpm model:registry:check`, `pnpm pricing:public-baseline`, and targeted page tests.

**Interfaces:** The review matrix references the exact canonical model IDs and records whether a claim is `live`, `tested-but-unpublished`, or `unsupported`; each proposed copy or offer change links to a verified provider/API or canonical price source.

- [ ] Inspect home, catalogue, model pages, pricing, comparisons, examples, workflow pages, Studio onboarding, MCP/plugin guidance, SEO metadata and social previews in EN/FR/ES.
- [ ] Record the current and proposed claim for each surface; include Seedance Draft/final, 1.5 direct, Seedream Lite/Pro resolution, Flash candidacy, and Seedream-to-Seedance continuity.
- [ ] Run the read-only registry and pricing checks and get a release review of the matrix before editing published claims.
- [ ] Commit only the review brief.

### Task 2: Factual localized content and quote projections

**Files:**
- Modify only the approved entries under `content/models/{en,fr,es}/`, `frontend/lib/examples/modelLandingData.{en,fr,es}.ts`, and the relevant colocated marketing components/content.
- Modify `frontend/config/model-registry.json` only for an approved publication or lifecycle change; regenerate its projections per the guide.
- Test: `tests/seedance-2-5-marketing-page.test.ts`, `tests/seedance-seedream-workflow-copy.test.ts`, `tests/pricing-public-projection.test.ts`, `tests/model-registry-parity.test.ts`, plus affected page architecture tests.

**Interfaces:** Copy identifies Draft as a separately billed 480p preview followed by an optional 1080p new render; it does not call it an upscale or guarantee frame identity. Price displays use exact canonical scenarios and omit unsupported scenarios.

- [ ] Add failing assertions for approved EN/FR/ES claims and existing inaccurate Pro 4K copy; assert Draft versus Fast/Mini distinction and quote provenance.
- [ ] Run the focused tests; require failures on the new assertions.
- [ ] Edit only reviewed claims and offer surfaces; regenerate model projections if the authored registry changes, and avoid replacing historical example labels.
- [ ] Run focused tests, registry check, public-pricing baseline, lint and `git diff --check`; commit only Task 2 files.

### Task 3: Browser, media and SEO acceptance

**Files:**
- Test: affected public route, SEO, hreflang, sitemap, examples and media contract tests; add focused tests only for a newly created behavior boundary.
- Update: `docs/marketing/bytedance-family-release-review.md` with actual verification and remaining exclusions.

**Interfaces:** Published pages match live capability and approved quotes in all locales; example links, original downloads, first Play, canonical/hreflang and JSON-LD remain valid.

- [ ] Smoke-test representative EN/FR/ES model, pricing, comparison, example and workflow routes in a browser; capture visible quote and Draft copy against current product behavior.
- [ ] Run the affected SEO and media contract tests, `pnpm model:registry:check`, `pnpm pricing:public-baseline`, and the media guide's checks for any changed assets.
- [ ] Record evidence and exclude any unlaunched Flash/portrait/Draft claim rather than implying availability.
- [ ] Commit only the acceptance record and any focused fixes; this is the final gate for marketing promotion.
