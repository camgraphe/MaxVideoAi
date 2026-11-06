# Kling 4.0 Flash capability and provider audit

Evidence collected 6 November 2026; completed 7 November 2026, 00:00 Europe/Madrid.
Candidate branch: `codex/gpt26-capabilities-flash-audit`, based on `594bceaee`.
This audit made no paid generation, production mutation, commit or push. Scores
and curated assets from PR #625 are outside its scope.

## Result

The three current Flash Fal contracts match the freshly fetched official Fal
schemas. Their input schemas and element subtype are unchanged from the pinned
5 November fixtures after excluding examples. No missing supported Fal option
was found in the catalog, canonical validation or provider projection.

Flash is not a model with no editing capability. Kling's direct API explicitly
documents editing with `base_video`, and Omni audio selection `native`/`original`.
Those controls are absent from the three published Fal Flash schemas and from
MaxVideoAI's current integration. Public EN/FR/ES model, gallery and comparison
copy now scopes its limitations to the current MaxVideoAI workflow.

Extend remains unavailable: the current official Kling usage guide labels video
extension as coming soon. First/last-frame pairs, multiple keyframes and voice
bindings are explicitly excluded for Flash. These are not inferred from old
Kling generations or from a generic launch page.

## Sources read live

- [Kling API changelog, 4 November Flash entry](https://kling.ai/document-api/updates/api?date=2026-02-11).
- [Kling Flash text-to-video API](https://kling.ai/document-api/api/video/4-0-flash/text-to-video).
- [Kling Flash image-to-video API](https://kling.ai/document-api/api/video/4-0-flash/image-to-video).
- [Kling Flash Omni API and explicit video-editing example](https://kling.ai/document-api/api/video/4-0-flash/video-omni).
- [Kling 4 usage guide, Flash capability table and extension status](https://kling.ai/document-api/api/usage-guide/kling-4-0).
- [Fal T2V API](https://fal.ai/models/kling/v4/flash/text-to-video/api), [I2V API](https://fal.ai/models/kling/v4/flash/image-to-video/api), [reference API](https://fal.ai/models/kling/v4/flash/reference-to-video/api).
- Fal machine schemas: [T2V](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=kling/v4/flash/text-to-video), [I2V](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=kling/v4/flash/image-to-video), [REF2V](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=kling/v4/flash/reference-to-video).

The Kling documentation shell did not expose its full content to the web reader.
Its public first-party document modules were therefore also fetched read-only:
[Flash Omni schema](https://s16-kling.klingai.com/kos/s101/nlav112918/api-doc/assets/api-OKeYtfTv.js),
[shared V4 parameters](https://s16-kling.klingai.com/kos/s101/nlav112918/api-doc/assets/kling-4-params-Lvo6ZWDF.js),
[Flash editing example](https://s16-kling.klingai.com/kos/s101/nlav112918/api-doc/assets/en-yjJhYS4D.js),
and [task-query contract](https://s16-kling.klingai.com/kos/s101/nlav112918/api-doc/assets/query-task-endpoints-CVqNf_n7.js).
These are the modules referenced by the live documentation application, not a
third-party interpretation.

## Exact capability matrix

| Capability | Current provider evidence | MaxVideoAI App / Studio / MCP |
| --- | --- | --- |
| Text generation | Fal T2V and Kling direct T2V | Supported as `t2v` |
| Opening-image animation | Fal I2V and Kling direct I2V; one first frame | Supported as `i2v`; empty prompt permitted |
| Visual references | Fal REF2V and Kling direct Omni | Supported as `ref2v`; exact owned originals required |
| Duration / resolution | Flash 3–20 whole seconds / 720p | All integer durations available; Fal default 5s |
| Ratios | Fal T2V: 16:9, 9:16, 1:1, 21:9; REF2V also `auto`; I2V has no ratio parameter | All Fal ratios preserved; no I2V ratio control |
| Prompt | Fal schemas: 26,000 characters | Catalog, canonical normalization and provider adapter preserve this limit |
| Native audio | Native sound; no Fal audio switch | Describe speech, music and ambience in prompt |
| Audio from source video | Direct Omni `settings.audio=original`; no such field in Fal Flash schemas | Missing from current integration; no silent fallback |
| Flat images | Up to 10, including opening frame; 30 MiB, minimum 300px sides, ratio 0.4–2.5 | Enforced before provider use |
| Flat videos | Up to 5; 3–20s each, 20s combined with video subjects; 300 MiB, 700–4553px sides, 23.9–60.05 FPS transport bounds | Exact owned metadata and cumulative duration checked |
| Subjects | Up to 7; up to 3 video subjects, 3–8s each; image subjects have frontal image plus 1–3 views | Supported via owned reference slots; no external provider IDs or voice bindings |
| Total references | Direct API counts up to 15 images + videos + elements; Fal has individual array limits | Conservative MaxVideoAI envelope is 15 actual originals including subject views; not represented as a universal provider maximum |
| Multiple shots | Prompt-directed cuts available; no Fal `multi_prompt` | Single prompt supported; structured shot fields rejected |
| Modify | Direct Omni explicitly supports a source `base_video`; Fal Flash has no dedicated source/edit field | Missing from current provider integration; `v2v` remains unavailable |
| Extend | Official usage guide says coming soon | Unavailable; no fabricated endpoint |
| End image / intermediate keyframes | Explicitly excluded for Flash | Unavailable |
| Voice cloning / element-bound voice | Explicitly excluded for Flash | Unavailable |
| Negative prompt / seed / CFG / FPS / output format | Not exposed by the three Fal schemas | Unavailable; rejected by canonical capabilities |
| 1080p / 4K | Not Flash API output resolutions | Unavailable |

Direct API details are not substituted into Fal requests. In particular, direct
Omni uses `adaptive`, supports omitted-duration prompt/source inheritance, and
documents language-weighted prompt limits. Fal uses `auto`, defaults duration to
5, and publishes a plain 26,000-character bound. The existing integration retains
its provider's explicit contract.

## Routing and credentials

The checked source routes both `kling-v4` and `kling-v4-flash` through Fal. The
legacy direct map contains eight Kling 3/O3 identities, no V4 identity:

- `frontend/src/server/video-providers/kling-direct/model-map.ts`
- `frontend/src/server/video-providers/router.ts`
- `frontend/src/lib/kling-v4-family.ts`
- `frontend/src/lib/fal.ts`

Even enabling every Kling direct flag does not route either V4 model into that
adapter. There is no direct-to-Fal fallback for these models today. Both use the
same single-POST queue and accepted-receipt recovery policy. A test with both
admin states and all direct flags enabled now locks this routing boundary.

A read-only metadata inventory used `vercel env ls production/preview --project
maxvideoai --format json`, filtering output to names, types and target only.
Production contains sensitive `KLING_ACCESS_KEY` and `KLING_SECRET_KEY`; neither
those names nor `KLING_API_KEY` appeared in the general Preview inventory.
No credential values were decrypted, exported or written. Presence does not
prove Flash direct entitlement, current balance or successful execution. Flag
values were not inspected. Source routing is independently decisive for V4.

## What a direct Flash editing integration requires

This is a separate provider integration, not adding Flash to the legacy map:

1. An adapter for `/omni-video/kling-4.0-flash` with `contents/settings/options`,
   explicit `base_video` versus `feature_video`, exact owned references and
   `native`/`original` audio. The existing adapter accepts legacy `model_name`,
   string duration, `mode`, `sound`, `image_list` and `video_list`, limited to 15s.
2. GET `/tasks?task_ids=...` polling and the new `outputs`, `billing`, `usage`
   response shape. Existing direct polling uses a legacy path plus the task ID
   and reads `task_result.videos`; it is not compatible unchanged.
3. Flash direct supplier-cost evidence and approved native `v2v` customer tariff
   cells. `kling-v4-flash-pricing.ts` rejects `v2v` and inherited duration. The
   current 72-class Flash tariff inventory only covers the three Fal modes;
   legacy V3 unit prices and Fal retail classes are not a substitute.
4. App/Studio/MCP source-role admission, owned-video validation, quote identity,
   request projection, certification and recovery contracts for the new mode.
   Incompatible or ambiguous direct failures must never reroute an editing
   request to a Fal reference-generation endpoint.
5. Preview credentials, direct access qualification and a separately authorized
   bounded paid canary before exposing the mode as executable.

No new direct routing or unpriced mode is enabled by this correction.

## Validation

`tests/kling-v4-flash-capability-audit.test.ts` checks actual routing with direct
flags enabled, all nine mode/ratio combinations at duration boundaries through
canonical → paid → provider projection, 26,000-character prompts, and rejection
of negative prompts, structured shots, output-format, FPS, seed, guidance, audio
switches, source-audio retention and voice controls.

The existing Flash contract, recovery, V4 current contract, provider routing,
functional opening, surface and marketing suites provide the surrounding
coverage. No runtime Flash correctness failure was found in the three published
Fal modes. Tests are offline evidence, not a paid or deployed canary.

Observed checks:

- 44 passed: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/kling-v4-flash-capability-audit.test.ts tests/kling-v4-flash-contract.test.ts tests/kling-provider-routing.test.ts tests/kling-v4-current-contract.test.ts tests/nov05-model-functional-opening.test.ts tests/nov05-model-marketing.test.ts`.
- 3 passed on disposable PostgreSQL 17: `node scripts/run-postgres-tests.mjs pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/kling-v4-flash-recovery.test.ts`. The simulated persistence-failure log is expected and acceptance is recovered without another POST.
- Initial 49-test routing/current-contract/Flash/surface/opening batch also passed.
- Edited Flash JSON parses successfully; `git diff --check` passed.
