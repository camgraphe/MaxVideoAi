# Studio media analysis and task activation

Prepared 2026-10-06 for [PR #397](https://github.com/camgraphe/MaxVideoAi/pull/397).
The user authorized validation, production activation and subsequent tests with
the existing OpenAI key. This premerge report records qualification and the release
procedure. It does not claim a completed production deployment.

## Qualified source and limits

Hosting source `735a229959879aaa234d6850e8573aea5faae57d` includes current main
`d07c789f98dda5fd248f675e5790669a619ac85f`. Vercel project `maxvideoai`
(`prj_CA8KpDAwYzihVJZyDNnEUrDszaMu`) has Pro/Fluid Compute enabled. Scoped
`after()` wake-ups and secret-authenticated minute crons process saved work;
task and analysis invocations allow 800 and 400 seconds respectively. GET/polling,
generation delivery and analysis delivery never schedule another analysis.

Luna retains image vision and simple edits. Sol gates video/audio analysis and
advanced assembly. Video inspection uses at most 12 sampled images over an
explicit interval of at most 60 seconds. Audio uses the separately metered
`gpt-audio-1.5` Chat Completions adapter over at most 30 seconds. Originals are
limited to 100 MiB. There is no claim of exhaustive video inspection, precise beats
or native audio input to Sol Responses.

Quick/Standard/Complex task ceilings are 100/250/500 credits; only actual recorded
consumption is charged. Complex and extensions require explicit client consent.
Media analysis has a separate exact maximum-price confirmation. Existing monthly
credits and packs retain their approved assistance policy.

## Bounded live qualification

Tests used a disposable copy of the production Neon database, branch
`br-withered-shadow-aemyln58`, and a synthetic qualification actor/project. No
existing customer's project, media, wallet or purchased credits were modified.
Sources were generated locally and uploaded privately through the canonical
storage owner. Real extraction, provider calls, journal recording and settlement
used the existing production key. These local-host results do not establish Linux
deployment extraction readiness; repeat bounded canaries on the deployed worker.

| Case | Completion | Confirmed maximum | Actual credits | Recorded provider cost |
| --- | ---: | ---: | ---: | ---: |
| 10s video, blue then red | 18.452s | 150 | 70 | $0.009551 |
| 30s audio, steady tone | 9.603s | 340 | 70 | $0.0105125 |
| Sol Quick, one requested advice sentence | 22.447s | 100 | 40 | Included in task ledger |

The video result correctly ordered blue/red and distinguished the observed frames
from an inferred transition between 4.17s and 5s. The audio result correctly
identified a continuous steady tone without speech. Both results explicitly mark
coverage as incomplete. All three runs completed with no unresolved hold. These
three samples establish basic correctness, not a p50/p95 latency or quality study.

Video usage: 3,041 input tokens (3,038 cache-write), 195 output, zero cached-input
tokens. Audio usage: 149 text-input, 300 audio-input and 54 text-output tokens. The
actual provider counters qualified settlement; no estimated cache saving was used.

The policy `studio-media-analysis-2026-10-06-v1` uses a $0.02 fixed processing
envelope plus $0.0001 per source second, and the existing fractional margin
convention (`marginPercent: 1` means 100% markup). The envelope covers bounded
original download/decoder costs even for a short interval. It is conservative
authored policy, not a measured Vercel invoice. Audio rates are $2.50/M text input,
$32/M audio input and $10/M text output, from the
[official audio model specification](https://developers.openai.com/api/docs/models/gpt-audio-1.5).
The host's configured duration fits
[Vercel Fluid limits](https://vercel.com/docs/functions/configuring-functions/duration);
review future infrastructure exposure against
[Vercel usage pricing](https://vercel.com/docs/functions/usage-and-pricing).

Local qualification: editor QA 1,165 passing tests and one skip, TypeScript clean,
canonical browser lane 12/12, frontend production build successful, exposure and
diff checks successful. Five inherited image lint warnings remain. Required
latest-head Quality CI and selected integration/financial lanes remain release gates.

## Production sequence

1. Obtain the fresh hosting review and passing required latest-head Quality CI.
2. Fetch current main and run `pnpm deployment:check` from the committed candidate.
   Incorporate a changed main and requalify before merging.
3. Explicitly apply additive migrations 64 and 65 to the intended production Neon
   branch, using the same validated migration bytes. No route bootstraps schema.
   SHA-256: migration 64 `39020ef0d50ba5b0ffd6a0b80ad7bed3e6d02aeb92f82dd9dec6f035eec77306`;
   migration 65 `f676d4ab5682fa818f7aa0a106bf511c372ad5c1b942e75ecc79f2ccb9f2e50a`.
4. Set production-only `STUDIO_VERCEL_WORKERS_ENABLED=true`,
   `STUDIO_CONVERSATION_TASKS_ENABLED=true`, `STUDIO_MEDIA_ANALYSIS_ENABLED=true`,
   `STUDIO_MEDIA_ANALYSIS_APPROVED_POLICY=studio-media-analysis-2026-10-06-v1`
   and the exact authored `STUDIO_MEDIA_ANALYSIS_POLICY_JSON`. Preserve the existing
   approved assistance policy and key. These new settings are inert on old source.
5. Merge the passing PR and let the Vercel Git integration deploy main. Do not upload
   a checkout, promote a preview or reassign domains. After READY, freshly fetch main
   and verify both public domains serve the merged Git revision.
6. Check unauthenticated worker calls fail, then qualify the real production
   workers with synthetic owned queued task/video/audio canaries. Verify settlement,
   held-credit release, source timing/quality and absence of unsolicited analysis.
   Record the merged SHA, deployment ID and bounded probe results in the release
   evidence. Never erase financial journals to clean up canaries.

## Recovery and export boundary

If qualification fails, stop new task/analysis dispatch using their feature flags;
keep the host available for qualified saved-result recovery. A configuration change
requires a Git-backed deployment before it affects existing functions. Preserve
unknown supplier exposure and reservations, immutable receipts and stored policy
identities. Never assume zero usage, redispatch an unknown call or grant extra
credits. Read exact owned evidence and use the existing operator reconciliation.

`STUDIO_CONVERSATION_EXPORTS_ENABLED` remains false. The current production project
does not configure the separate `TIMELINE_EXPORT_ECS_*` Fargate renderer. This
activation can prepare/edit an assembled timeline but does not qualify a final MP4
export. Export activation requires its existing renderer configuration, real
output qualification and exact client quote contract; do not silently enable it.
