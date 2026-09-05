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

## Review follow-up — six Important findings

Fix commit: `c7f8922847c58d05d6a66e486a8d9fdf9b90b5bc` (`fix(home): harden hero playback recovery`)

### Fix details

- Consumes each manual play request once, then requires player/document visibility for later resume.
- Gives same-thumbnail reselection its own play-request sequence so it cannot stall in loading.
- Limits idle scheduling to unloaded media, preventing visibility changes from queuing callbacks over mounted, playing, or user-paused video.
- Invalidates pending `play()` promises on every newer play, pause, selection, visibility suspension, native error, and unmount; stale and expected `AbortError` rejections cannot hide the current frame.
- Adds visible `aria-live` loading/error feedback and retry labels through the real EN/FR/ES homepage copy and `HomeHeroContent` contract.
- Remounts the video with a new attempt key after native media errors before retrying playback.

### Follow-up RED

Command: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/homepage-hero-playback.test.ts`

Recorded result against `82a2c7199`: 10 tests, 6 passed, 4 failed. Failures reproduced same-thumbnail reselection, repeated idle scheduling after mount, same-element stale promise rejection, and missing localized/native-error recovery. The visibility reproduction was then tightened to begin onscreen so it exercises the reported immediate restart path.

### Follow-up GREEN

Command: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/homepage-hero-playback.test.ts tests/homepage-lcp-performance.test.ts tests/homepage-real-examples-preview.test.ts tests/home-redesign-architecture.test.ts tests/home-redesign-sections-architecture.test.ts && pnpm --dir frontend exec eslint components/marketing/home/HeroVideoShowcase.tsx components/marketing/home/useHeroVideoPlayback.ts components/marketing/home/HomeHeroSection.tsx components/marketing/home/home-redesign-types.ts --no-cache && pnpm --dir frontend exec tsc --noEmit --pretty false && pnpm --dir frontend run i18n:check && git diff --check`

Result: exit 0; 30 tests passed, 0 failed; focused ESLint, TypeScript, EN/FR/ES localization parity, and diff checks passed. Node emitted the repository's existing engine warning because the host uses Node 23 while the package requests Node 22.
