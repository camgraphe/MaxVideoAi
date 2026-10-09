# Scoped public typography implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Stop sending editorial typography rules on public pages that do not render prose, while preserving the existing documentation, recommendation and blog appearance.

**Architecture:** Remove only the typography plugin from the default Tailwind configuration; a dedicated config extends the shared theme and adds that plugin solely for scoped editorial sheets. Convert the two legacy prose wrappers to `public-prose prose`, where public-prose owns the native styles and prose keeps the plugin’s internal selector references matching; import the synchronous scoped stylesheet in their owners. Blog keeps its exact scoped stylesheet using the dedicated configuration. No global utility splitting or theme-bootstrap changes.

**Tech Stack:** Next.js 15, Tailwind 3.4, PostCSS, TypeScript, Chromium browser verification.

**Spec:** AGENTS.md initial-loading/media requirements and docs/engineering/core-web-vitals.md; user authorized the CSS/INP/server workstreams with Sol6.1 xhigh implementers and root review. Diagnostic and exact baseline proof: /Users/adrienmillot/.codex/artifacts/cwv-three-axes-2026-10-09/css/.

## Global Constraints

- Workspace /Users/adrienmillot/.codex/worktrees/cwv-model-public-presence/MaxVideoAi V2; branch codex/cwv-scoped-typography; baseline b63fe687e07dc7a774e289e51c820c8245aad935 (comparison policy candidate, same CSS as ec9976). Preserve old .next until its provenance/use is checked; do not assume it is a valid baseline.
- Preserve all visible content, theme, utilities, resets, CSS specificity/cascade, route/SEO metadata, media geometry, initial posters and interaction behavior. No dependency/config version upgrades, installs, package changes or unrelated cleanup.
- Root schedules every compilation/build/browser session. No simultaneous benchmarks. Local Next15.5.18 vs manifest/deployed15.5.25 must remain disclosed; CSS proof currently matches exact production bytes despite this difference.
- Commit reviewed-scope source/tests/docs and this plan. Do not push, PR, merge, deploy or spawn subagents; root handles those already authorized steps after review.
- This is a modest byte saving, not an established LCP gain. Count total CSS per route and request count; prose readers may gain a small amount of CSS. Retain all timing runs and regressions.

## Review Focus

- Blog CSS compiles with its dedicated plugin and retains the exact descendant rules without regenerating reset/utilities.
- `.public-prose` must equal the effective cascade of `.prose.prose-slate.max-w-none` for the two current Markdown readers, including slate variables, headings, code, lists, tables, media and excluded `.not-prose` descendants. It is not a general-purpose wrapper for nested Tailwind utility markup; 45 current source documents have no authored descendant classes. Guard actual generated HTML so future utility-bearing content requires an intentional cascade review.
- CSS retained after client navigation must not alter unrelated pages or utilities, in either stylesheet arrival order and light/dark themes.
- Global CSS has no typography rules, but all non-typography rules/declarations and root/theme bootstrap stay unchanged.
- Production builds deliver the scoped sheet on docs detail and best-for detail only where needed; public pages without prose do not acquire it through a shared layout.

## Task 1: Move editorial typography from global output into its readers

**Files:**
- Modify `frontend/tailwind.config.ts`: preserve theme/content/core configuration, omit typography plugin/import.
- Create `frontend/tailwind.typography.config.ts`: extend that exact shared configuration with typography plugin for scoped `@apply` use.
- Create `frontend/components/marketing/public-prose.css`: dedicated config and `.public-prose { @apply prose prose-slate max-w-none; }`, no `@tailwind` reset/components/utilities emission.
- Modify the two real consumers `frontend/app/(localized)/[locale]/(marketing)/docs/[slug]/page.tsx` and `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_components/BestForEditorialPanels.tsx`: synchronous stylesheet imports, equivalent native wrapper; other classes/content unchanged.
- Modify `frontend/app/(localized)/[locale]/(marketing)/blog/blog-prose.css` to use the dedicated config; no other declaration edits unless an evidenced equivalent fix is necessary.
- Add `tests/public-prose-styles.test.ts` and `tests/public-prose-cascade-browser.test.ts`, extending an existing bounded style compiler helper when appropriate. Keep existing blog-style/cascade tests passing and architecture contracts explicit.
- Update `docs/engineering/core-web-vitals.md` with ownership and measured limits.

**Interfaces:**
- Default Tailwind config remains compatible with all existing importers; typography is enabled explicitly in the two prose stylesheet owners.
- `.public-prose` replaces the three legacy wrapper classes as one synchronous styling contract with the legacy prose marker retained for internal Tailwind selectors, preserving slate + max-width none and `.not-prose` behavior.

- [x] Read instructions and existing prose/style tests. Establish the baseline compiled CSS: current exact production global242672Bminified; default-plugin removal proof229247B. Controlled gzip37574→35862B is separate from CDN encoding; do not equate controlled gzip with live transfer bytes.
- [x] Add failing meaningful compilation and computed-style regression checks. Compare the effective baseline `.prose.prose-slate.max-w-none` to native wrapper including ordered duplicate variable declarations; do not compare only `.prose` gray defaults. Assert no unrelated global rules or reset from the scoped sheets. Check non-typography global rule parity and absence of generated `.prose` rules under default config.
- [x] Implement the bounded config/sheet/import changes. Do not fix false-positive scanner prose words by rewriting unrelated comments; removing the plugin from global ownership addresses that cause. Preserve plugin availability for blog `@apply` modifiers and its exact compiled output.
- [x] Verify real compiled styles in browser for mobile390/desktop1440, light/dark, both stylesheet orders and after removing/adding prose DOM as on client navigation. Include headings/links/strong/inline and block code/blockquote/lists+markers/tables/images/native media and `.not-prose`. Check every current generated docs/BestFor HTML for descendant utility classes (language-* syntax labels are not utilities). Lock this current-content boundary in a test and document it. Do not invent utility descendants as a required parity case: a late native sheet would have different equal-specificity priority there, and reorganizing global layers for this modest saving is outside the chosen scope.
- [x] Run focused prose/blog/route architecture tests, frontend lint, lint:exposure, git diff --check. Produce comparable baseline/candidate production builds in the isolated workspace with explicit provenance; preserve baseline before editing/building and coordinate CPU. No production database connection for fixtures or build.
- [x] Smoke actual docs, best-for, blog article and non-prose examples/home paths EN/FR/ES with equivalent content, canonical/hreflang/JSON-LD, direct visits and real client navigation both directions where links exist. Compare visible geometry/computed styles. Measure all CSS bodies/request counts and cold mobile FCP/LCP/CLS in alternating reference/candidate order n>=3 each; report spread and environment. Fix reproducible regressions, disclose inconclusive timing gains. Root may separately execute production delivery verification.
- [x] Commit, self-review and report DONE/DONE_WITH_CONCERNS to `.superpowers/sdd/2026-10-09-scoped-public-typography/task-1-report.md`, including SHA, exact checks, raw artifact paths, route-specific bytes and limitations. Stop for independent root review.

## Root ruling after actual-content browser regression

Tailwind @apply preserves seven internal literal `.prose >` references inside `:where`; removing the legacy wrapper marker makes those selectors stop matching. The full 86 descendant-rule order and declarations are unchanged, so rewriting their cascade is not the solution. The two public Markdown wrappers must use `className="public-prose prose"`: public-prose owns all emitted scoped styles, while prose is only the required compatibility marker because the default config no longer enables the typography plugin. Keep synchronous imports and all selector order/bytes unchanged. Update the owner guard, current-content cascade tests and guide to explain this marker and cover first/last headings, paragraphs, lists and code plus the actual generated HTML. A future reintroduction of global typography would risk duplication; the global compilation contract must keep preventing that. Baseline is unchanged; rebuild candidate and rerun the affected reader/navigation cells with preserved raw failure evidence.

## Root ruling for the blocked Vercel preview

The first exact-head preview failed with a confirmed 8 GiB out-of-memory report during lint/typecheck after successful compilation. One uncached retry remained BUILDING without any logged post-typecheck progress for 20m37s, versus under three minutes for the entire post-compile phase of the preceding successful builds. Root canceled only that preview; this is not evidence of a second OOM. Next-intl adds a custom webpack hook that disables Next15.5.25's default webpack build worker. A bounded final correction may explicitly enable experimental.webpackBuildWorker while retaining webpackMemoryOptimizations and every lint/type/release gate. This is a build-memory mitigation hypothesis, not a proven cause of the CSS diff's OOM. Validate plugin compatibility with a full build and exact CSS/route output parity; fresh exact-head CI and preview must succeed before the normal protected merge. No dependency upgrade, environment/resource change, check suppression or production upload is allowed.
