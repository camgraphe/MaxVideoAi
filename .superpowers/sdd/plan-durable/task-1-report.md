# Task 1 report — Hero playback corrections

## Implementation and files

- `frontend/components/marketing/home/HeroVideoShowcase.tsx`: delegates playback lifecycle to a focused hook, observes the main player, exposes actual playback state, keeps the optimized poster visible until a frame is ready, removes the duplicate native poster request, and makes Play-labelled thumbnails start playback immediately.
- `frontend/components/marketing/home/useHeroVideoPlayback.ts`: owns desktop/reduced-motion/Save-Data policy, visibility and document lifecycle, idle scheduling/cancellation, explicit playback intent, media event state, user-pause retention, and stale callback/promise guards.
- `tests/homepage-hero-playback.test.ts`: component-level JSDOM reproductions for policy-gated loading, deferred desktop idle, one-click thumbnail playback, event-driven state, visibility pauses, user-pause retention, stale work, errors, and retry.
- `tests/homepage-real-examples-preview.test.ts`: removes the superseded source-text playback test; the new behavioral suite now protects that contract while the hook owns it.

## RED

Command:

`pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/homepage-hero-playback.test.ts`

Result on the original component: 6 tests, 0 passed, 6 failed. Failures showed the absent player visibility observer, idle-delayed manual selection, absent video after one click, and missing lifecycle/error behavior.

## GREEN

Command:

`pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/homepage-hero-playback.test.ts tests/homepage-lcp-performance.test.ts tests/homepage-real-examples-preview.test.ts tests/home-redesign-architecture.test.ts tests/home-redesign-sections-architecture.test.ts && pnpm --dir frontend exec eslint components/marketing/home/HeroVideoShowcase.tsx components/marketing/home/useHeroVideoPlayback.ts --no-cache && pnpm --dir frontend exec tsc --noEmit --pretty false && git diff --check`

Result: exit 0; 26 tests passed, 0 failed; focused ESLint, TypeScript, and diff checks passed.

## Self-review concerns

- The existing fullscreen-labelled button still has no action. This task deliberately leaves its design and behavior to the parent decision requested in the brief.
- Browser measurements and manual browser playback were excluded by the task brief; the parent owns them.

## Commit

Included in the task commit containing this report (`HEAD` at handoff).
