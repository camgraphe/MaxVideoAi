# Public Watch Performance Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task by task.

**Goal:** Remove unnecessary server work and translation payload from direct public watch pages, with verified delivery.
**Architecture:** Preserve the watch data/reader ownership; isolate only the video route in a sibling group and share the existing cookie-based server runtime with Core.
**Tech Stack:** Next.js App Router, React, next-intl, SWR, TypeScript, Node tests, Playwright.
**Spec:** docs/superpowers/specs/2026-10-11-public-watch-performance.md

## Global Constraints

- Preserve public `/video/[id]` URLs, metadata, canonical redirects, visibility, eligibility, JSON-LD, original media, poster priority/geometry, and displayed current quotes.
- Preserve Core full dictionaries and watch cookie precedence (`LOCALE_COOKIE`, then valid `NEXT_LOCALE`, then default), English fallback, auth/session/SWR/theme/font/style/analytics/consent behavior.
- Only direct watch messages narrow to `nav` and `footer`; both dictionary and fallback must be filtered before client serialization. Keep one runtime instance per active route.
- Preserve unrelated work, `.serena/`, ignored evidence, and production data. No migrations, live writes, credentials in artifacts, manual deployment or bypassed CI.
- Product implementation and fixes are delegated to Sol 6.1 xhigh. Controller owns independent verification and delivery. No implementer subagents.

## Review Focus

1. Unused quote removal accidentally changes visible quotes or public guards: behavioral owner/route tests and existing quote-context/detail/source tests.
2. Narrow provider still inherits full messages, or Core loses namespaces: actual server runtime projection tests and HTML/Flight inspection.
3. Cookie/fallback, session, analytics or style drift: runtime behavior tests, existing contracts and browser locale/navigation checks.
4. Route move breaks paths, share control, canonical/SEO or gallery history: reference search, typecheck, focused SEO/history tests and real route smoke.
5. Bytes fall but load timing regresses: equal production-build fixtures, repeated cold-context probes, production before/after capture; report spread and limitations.

### Task 1: Remove the unused watch-data price read

**Files:** modify `frontend/server/video-seo.ts`, `tests/watch-page-signals-architecture.test.ts`; add a focused `tests/video-seo-no-unused-price.test.ts` behavioral test; update the relevant performance/pricing documentation only if useful.

Read AGENTS.md, docs/engineering/llm-working-guide.md and relevant pricing/architecture contracts. Read `/Users/adrienmillot/.codex/artifacts/cwv-opportunities-2026-10-11/watch-proof/evidence.md` and the adjacent reusable proof before designing the test.

- [ ] Add a focused behavioral regression using the real watch owner and mocked I/O boundaries, showing eligible/canonical/local reads and missing/private guards do not invoke the obsolete quote helper. Assert preserved returned semantic fields and actual reader quote-context behavior through existing real-reader tests. Keep tests small and meaningful; do not copy the whole external proof or mock the function being asserted. Run RED against baseline and retain evidence.
- [ ] Remove the `quoteCurrentExamplePrice`/`CurrentExamplePrice` import, `VideoWatchPageData.currentPrice`, both local and production computations and returned field. Retain the shared quote helper for other callers and all actual reader quote preparation.
- [ ] Replace the obsolete architecture assertion requiring the call with the intended owner boundary. Run the new behavioral test plus watch-page-signals-architecture, video-page-architecture, video-page-quote-context-route, example-watch-quote-context, example-watch-detail, watch-source-image-originals and relevant canonical/related tests. No timing claims from mocked tests.
- [ ] Self-review, run focused lint and diff check, commit only this task plus the controller-authored spec/plan if still uncommitted. Record commands, pass/fail counts, RED/GREEN, commit and limitations in task report. Do not build, push or merge; controller coordinates those.

### Task 2: Isolate public watch messages while preserving the runtime

**Files:** move existing `frontend/app/(core)/video/**` into `frontend/app/(public-watch)/video/**`; modify Core layout; add sibling `(public-watch)/layout.tsx`; add shared server runtime under `frontend/app/_components/` and shared metadata owner under `frontend/app/_lib/` as needed; relocate the already-shared watch share control to `frontend/components/examples/`; update affected imports, path contracts and engineering ownership documentation. Add focused runtime behavior tests and extend `tests/marketing-client-message-performance-contract.test.ts`.

Read the spec, closest instructions and `/Users/adrienmillot/.codex/artifacts/cwv-opportunities-2026-10-11/watch-layout-audit.md`. Task 1 has already removed the unused data price; keep that change.

- [ ] Inspect current Core layout, dictionary resolver, I18nProvider, LocaleSync, MarketingVideoLayout/auth, session/SWR, share usage and path-based contracts. Make a test fail for the intended shared runtime message boundary: Core full messages, watch nav/footer only, EN/FR/ES + missing/invalid cookie precedence, English fallback retained. Test real resolver/runtime with mocked request and client leaf boundaries, not just regex.
- [ ] Extract the existing Core runtime into one shared server component with an optional explicit message-namespace input. Core calls it unfiltered; new public-watch calls it with existing MARKETING_CLIENT_MESSAGE_NAMESPACES. Select both dictionary and fallback using existing pickClientMessageNamespaces; preserve the existing shared-object identity when fallback === dictionary (EN), avoiding duplicate equivalent message serialization. Preserve existing cookie selection, wrappers/effect order, auth snapshot in MarketingVideoLayout, app styles, local Geist font settings, metadata/viewport, organization/WebSite schema and exactly one analytics/consent/runtime instance. Share metadata declarations without importing one route layout from another. Keeping the original font file is required; its generated class hash may change but its rendering/options must not. Do not use LocaleRuntime as a substitute, route-header guesses, client pathname filtering or middleware changes.
- [ ] Move only the video route tree under the same root layout. Move the shared share component to components/examples and repair imports. Preserve direct watch reader English copy and all route data/SEO behavior. No redesign, new dependencies, cache semantics changes, or session lifecycle policy changes.
- [ ] Update affected architecture/path tests and documentation; run targeted runtime/marketing/watch/SEO/share/gallery history tests, frontend typecheck, frontend lint, exposure lint, diff check. Test locale and provider behavior across group transitions where meaningful. Controller owns full builds/browser/performance/delivery, so describe gaps explicitly.
- [ ] Self-review and commit. Report exact changed ownership and all test evidence. Do not build, push, merge, spawn agents or edit unrelated files.

## Controller Verification and Delivery

Each implementation gets an independent scoped spec/quality review; a final whole-branch review follows. Freeze baseline/candidate build identity and environmental limitations. Probe direct and redirected watch pages, EN/FR/ES cookies and toggle, anonymous app/gallery/watch navigation, media/quote/schema and history. Use authenticated fixtures where available and disclose limitations rather than claiming live auth coverage. Collect complete HTML/Flight bytes and n>=3 comparable browser timings with LCP/CLS and no page errors. Block reproducible regressions. Run required checks via CI; fetch origin main and run deployment:check on the committed candidate immediately before normal PR merge. Verify Git deployment and both domains against merged source. Persist reports and all decisions.
