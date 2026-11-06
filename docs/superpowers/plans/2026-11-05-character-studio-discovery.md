# Character Studio discovery and lifecycle implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement and verify each bounded task.

**Goal:** Present the reviewed Dixie/Vesper films on Home and Explorer, align current pricing and branding, and prevent old character instructions from returning after New.

**Architecture:** Reuse the existing reviewed-public-marketing getter, streamed below-fold presentation and shared manual video player. Preserve the existing model gallery and canonical pricing owners. Character account persistence remains intentional, with an explicit restored-draft notice; New invalidates both persisted entry links and abandoned asynchronous selection.

**Tech stack:** Existing Next.js, React, CSS modules/Tailwind, test fixtures and isolated Neon/Vercel preview.

**Spec:** User's 2026-11-05 requests in this chat; validation is on preview, no production exposure.

## Constraints and review focus

- Production, tariffs and private source media remain unchanged. No paid generation.
- Only reviewed public independent copies play; missing catalogue returns honest stills or no optional module.
- Preserve home opening/primary poster and 24-card examples gallery; no new video transfer before Play.
- Keep EN/FR/ES URLs, canonicals, meta descriptions and historical receipts intact.
- Test New after free text, custom colors, uploaded references, ?job hydration and late completion; account drafts cannot leak.

## Tasks

- [x] Home: add HomeCharacterStudio and streamed HomeCharacterStudioProof after creation chapter; actual portrait/film pairs, native manual playback, localized links to Studio/Recast/Explorer. Verify published/absent film behavior and existing streaming contracts.
- [x] Explorer: stream CharacterStudioPublicFilms into CharacterStudioExplore and the unfiltered first examples page; retain existing gallery/pagination and exclude already rendered video URLs. Test catalogue absence, route eligibility and non-destructive Recast navigation.
- [x] Pricing: retain native Nano21 quote projection; explain per-image billing and Recast source/output duration plus resolution. Compare real preview estimates and public quotes for 1K/2K/4K without generation.
- [x] Lifecycle: make New clear consumed job URL and all draft fields, ignore old completion selection, visibly identify restored drafts and preserve deliberate tab transitions. Test payload/storage/remount/account boundaries.
- [ ] Validate actual desktop/mobile views, SEO/branding residues, current-main integration and deployed exact commit. Preserve evidence and document competitor gaps separately from verified features.
