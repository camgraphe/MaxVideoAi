# Creator tools qualification record

Reviewed 2026-10-19 against the isolated `codex/five-creator-tools` branch.
Implementation and local verification are complete only to the extent recorded
below. Public release remains closed for all five tools.

## Delivered paths

| Tool | Implemented execution | Shared continuation | Live qualification |
| --- | --- | --- | --- |
| Subtitles | Scribe v2 transcription; editable revisions; SRT/VTT; separately quoted captioned MP4 | Library documents; clip and saved-sequence Studio captions; MCP | Paid transcription, deployed ECS image and invoice reconciliation pending |
| Lip Sync | LTX audio-driven photo; separately gated LatentSync video with matching segments | Owned result, download, Studio add/replace, MCP | Photo/video mouth fidelity, real durations and account billing pending |
| Product Photo Editor | Canonical GPT Image 2.5 and Nano Banana 2 image editing | Source/style library inputs; owned result, Studio and MCP | Product/brand fidelity and real billing pending; no pixel-lock claim |
| Product Video Editor | Canonical Wan 3 continuous-segment editing; explicit audio policy | Private synchronized comparison, owned result, Studio add/replace, MCP | Real edit fidelity, duration/audio and billing pending |
| Motion Transfer | Explicit Wan reference guidance or separately gated Kling V3 Standard Motion Control | Character Builder/library/Studio entry; owned result, Studio and MCP | Character/motion fidelity, orientation and real billing pending |

Each tool has EN/FR/ES app and public-page implementations. Public routes,
navigation, sitemap and contextual discovery share the closed release record.
Authenticated execution additionally requires deployment flags; specialist gates
remain independent. Owned operation and document recovery remain available when
purchase gates close. None of these local paths establishes production availability.

## Local evidence

- Complete fast suite during integration: 7,926 passed, zero failed, one existing
  skip. Later additions were checked with their focused suites; the complete
  candidate must also pass required Quality CI.
- MCP suite after recovery-gate changes: 168 passed, zero failed, one existing
  skip; 70 offline selection scenarios. Instruction budgets checked across all
  256 capability combinations. No real Codex/Claude host metric was recorded.
- PostgreSQL 17 tests exercise quote origin/account/client isolation, exact
  reservations and refunds, duplicate confirmation, source changes, revision
  conflicts, leases, spending limits and provider acceptance uncertainty.
- Final integrated creator/subtitle/media/PG/browser suite: 128 passed, zero
  failed. Four additional Studio action tests verify explicit application,
  idempotent lost-response retry, revision conflict, full audio append and read
  retry. Review findings were repaired before PR delivery.
- Real FFmpeg/Chromium tests exercise source segments, audio mux and duration,
  subtitle frames, and Studio mix trimming/gains/mute with measured audio tones.
  Studio suite: 1,308 passed and one existing skip; replacement-specific tests
  additionally cover timing, ownership, locked tracks and revision conflicts.
- Browser fixtures cover five tools × three languages × mobile/desktop for
  marketing and app empty states. Product Video comparison uses explicitly
  synthetic local media. DOM tests cover quote invalidation, account changes,
  lost replies, draft preservation, deleted sources and signed-URL renewal.
- Frontend build, TypeScript, focused lint, exposure checks and diff checks pass.
  Full lint retains six pre-existing warnings. No paid provider request was used
  to obtain any of these results.

Reproduce with the commands in [the ownership guide](creator-tools.md),
`pnpm test:validate -- --suite fast`, `pnpm test:editor`, and the focused
`creator-*`, `subtitles-*`, `toolbox-generation-scope*` tests. Browser fixture
evidence can be regenerated with `CREATOR_WORKSPACE_EVIDENCE_DIR` and
`CREATOR_MARKETING_EVIDENCE_DIR`; fixture images are not provider demonstrations.

## Release requirements

1. Apply migrations 69–75 through the normal database migration owner. Existing
   commercial overrides must survive; missing explicit policy must fail closed.
2. Publish the media-worker image containing subtitle dispatch/render/mix code,
   Chromium and FFmpeg. Validate worker configuration and actual dispatch before
   enabling paid execution. Measure cron finalization/reconciliation throughput.
3. Obtain approval for exact account quotes before any paid canary. Record each
   profile's source/output identities, selected segment, measured duration/audio,
   supplier request, charged amount and invoice evidence. Review visual fidelity
   on real inputs; local doubles cannot replace this step.
4. Verify real MCP host/version discovery, confirmation and recovery separately
   from offline descriptor tests. Review the localized public pages with genuine
   approved demonstrations before opening discovery.
5. Require successful Quality CI and current-main ancestry. Merge/deploy only
   through the GitHub/Vercel delivery policy and verify both production domains
   against the merged commit. Web deployment alone does not deploy the worker.

No paid canary, production migration, worker deployment, public activation or
domain change was performed for this delivery.


## Visual revision after product review — 2026-10-19

The schematic first pass was rejected in product review. The replacement uses
five authored artistic renders, direct EN/FR/ES copy, task-specific input labels,
progressive settings, visible state and grouped subtitle exports. All image
provenance is recorded in `frontend/public/assets/tools/creator-art/provenance.json`.
The presentation images are not outputs from the creator operation profiles.
The public activation and supplier qualification gates remain closed.

The local interactive review mounts the actual navigation, media picker, handoff
and Studio action components. Only session, routing and API boundaries are
simulated, with local-only data and zero-dollar quotes; there is no production
write, provider generation or payment. It is evidence of interface behavior,
not evidence of live authenticated delivery or provider fidelity.

The [visual review record](../qa/creator-tools-visual-review-2026-10-19.md)
documents concept comparisons, responsive checks, interaction evidence, loading
observations and deliberate differences. User visual acceptance is pending.

### Dialogue and subtitle results added in the same review

The user approved one Wan 3 text-to-video presentation source: 12 seconds,
480p, 16:9, English dialogue with audio, at USD 0.78. The completed generation
is `e5ad4469-b09c-45da-9a16-d0155167a610`, saved in the connected account's library.
This is a source scene for demonstrating subtitles, not a creator-profile canary.
Local MLX Whisper produced the timed transcript. The real shared subtitle worker
renderer produces Pop, Cinema and Contrast MP4 files; the presentation plays and
downloads those files. Provenance, source fingerprint and transcript are stored
alongside the hashed media under `public/assets/tools/subtitle-demo`.

The real source exposed AAC container/encoder padding that incorrectly failed
the strict duration check. Presented stream duration and a bounded final mux
repair the issue without relaxing the output guard. Tests cover 44.1kHz input,
caption intervals and retained audio. Public page CTA wording no longer contains
“coming soon”; route/publication and execution flags retain their independent
release requirements. No production deployment or activation was performed.
