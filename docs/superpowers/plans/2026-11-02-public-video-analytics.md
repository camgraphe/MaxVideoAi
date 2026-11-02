# Public Video Analytics Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline.

**Goal:** Separate future video opens and user-started plays in Vercel automatically after SEO approval.
**Architecture:** Server projection authorizes a public analytics path. A hidden marker and Vercel sanitizer coordinate asynchronous reader pageviews; manual controls report actual playback.
**Tech Stack:** Next.js, React, TypeScript, Vercel Analytics, node:test, jsdom.
**Spec:** docs/superpowers/specs/2026-11-02-public-video-analytics-design.md

## Global Constraints
- Preserve existing SEO, media loading and consent boundaries.
- No private IDs, prompts, signed media URLs, or raw arbitrary slugs in events.
- Use an isolated branch based on current origin/main; no production upload from Desktop.

## Task 1: Implement and validate public video measurement

**Files:** `frontend/lib/analytics/public-video.ts` (browser identity and transport); `frontend/components/analytics/PublicVideoAnalytics.client.tsx` (reader marker); existing watch detail projection, Vercel sanitizer, shared reader and manual controls; focused tests and media guide.
**Interfaces:** `ExampleWatchDetail.analyticsPath?: string | null` is produced only by the server's approved/indexable projection. Playback observer consumes this path and reports only after accepted `playing`. The Vercel sanitizer consumes the mounted reader marker and deduplicates that reader's view.

- [x] Add behavioral tests for approval/privacy, async reader pageviews and manual playback including retries/duplicates and consent.
- [x] Run focused tests; expected: failures for missing behavior.
- [x] Implement server projection, marker/transport and control callback, and exclude API host.
- [x] Run focused tests; expected: all pass.
- [x] Run typecheck, lint, exposure guard, SEO/media contracts and browser smoke; expected: all pass and unchanged metadata/media behavior.
- [x] Commit, obtain one independent final review, fix substantive findings, prepare PR through normal delivery.

## Review Focus
Check delayed SDK loading, rapid reader navigation, retained private-path masking, consent changes during playback, and unchanged SSR metadata/media loading. No network or role lookup may enter the playback critical path.

## Verification outcome

203 focused analytics/media/SEO contracts pass, including desktop/mobile real playback. TypeScript, ESLint (0 errors; existing unrelated warnings), exposure and diff checks pass. Independent review found a sticky Vercel pathname override; corrected to `pageview({})`, with the old behavior reproduced against the actual delivery script before the fix and the corrected browser scenario passing. The same suite can run against a downloaded SDK using `VERCEL_ANALYTICS_SDK_FIXTURE=/absolute/path/script.js`; ordinary CI remains offline. Delivery still requires current-head Quality CI and preview/production alignment gates.
