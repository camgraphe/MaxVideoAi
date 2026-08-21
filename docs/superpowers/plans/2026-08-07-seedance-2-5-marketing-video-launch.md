# Seedance 2.5 Marketing Video Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce two flagship Seedance 2.5 hero videos plus one optional human-dialogue video, validate their real billing and storage paths, and integrate accepted outputs into the standard localized MaxVideoAI model-page template without opening public generation or indexation.

**Architecture:** The existing hidden Seedance 2.5 ModelArk route remains administrator-only and fail-closed. Audio support is added as a tested capability of that dedicated profile, after which the approved generations run through the normal MaxVideoAI job, wallet, polling, durable-storage, moderation, and playlist paths. The public route moves from the special prelaunch renderer to the shared decision-page renderer, but registry discovery, app, pricing, comparison, sitemap, and indexation flags remain closed.

**Tech Stack:** TypeScript, Next.js App Router, Node test runner through `tsx`, BytePlus ModelArk video adapter, PostgreSQL/Neon jobs and playlists, MaxVideoAI wallet billing, localized JSON content, Playwright/browser smoke testing.

## Global Constraints

- Work on the current `main` branch and preserve every unrelated worktree change.
- Read `AGENTS.md`, `docs/engineering/llm-working-guide.md`, `docs/engineering/model-registry.md`, `docs/model-launch/seedance-2-5.md`, and the nearest model-page `AGENTS.md` before execution.
- The approved production brief is `docs/superpowers/specs/2026-08-07-seedance-2-5-marketing-video-launch-design.md`.
- Generate two 24-second, 16:9, 1280×720, 24 FPS hero videos. Do not generate marketing assets at 480p.
- Generate one optional 15-second human-dialogue video only after the audio request, billing, polling, durable-copy, and refund contracts are safe.
- Run one initial take per concept and at most one selective retry across the entire pack.
- The provider-cost envelope is USD 14.56 initially and USD 20.11 including the single longest authorized retry.
- Compute and record the MaxVideoAI preflight quote before every paid request; do not submit if a quote differs materially from USD 13.87 for 24 seconds or USD 8.67 for 15 seconds at 720p.
- Use only the dedicated Seedance 2.5 model ID, profile, flags, and prices. Never borrow a Seedance 2.0 model ID, flag, or price.
- Keep `SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=true` throughout this plan.
- Keep registry publication closed for app, pricing, examples-family discovery, comparison, sitemap, and indexation.
- Do not commit API keys, signed provider URLs, provider task IDs, private wallet IDs, or private account identifiers.
- Accepted outputs must use durable MaxVideoAI URLs before they become public media.
- Do not generate logos, labels, subtitles, or interface text inside the videos.
- If the dialogue contract is unsafe or the audio asset fails acceptance, launch the page with the two silent hero videos. Do not replace it with another effects-heavy clip.
- Benchmark scores, VS pages, broad internal linking, homepage promotion, public generation, pricing publication, and SEO indexation are separate launch work and are not authorized by this plan.

---

## File Map

### Existing hidden-runtime baseline

- Modify/verify `frontend/src/config/fal-engines/seedance-2-5.ts`: hidden raw engine capabilities and UI schema.
- Modify/verify `frontend/src/config/fal-engines/launch-config.ts`: dedicated Seedance 2.5 pricing details.
- Modify/verify `frontend/src/config/fal-engines/registry.ts`: raw engine registration.
- Modify/verify `frontend/src/server/video-providers/byteplus-modelark-profiles.ts`: dedicated profile and audio capability.
- Modify/verify `frontend/src/server/video-providers/byteplus-modelark-profile-policy.ts`: kill switch, administrator-only policy, and runtime transformation.
- Modify/verify `frontend/src/server/video-providers/byteplus-modelark-constants.ts`: factual model limits.
- Modify/verify `frontend/src/server/video-providers/byteplus-modelark.ts`: provider facade and configuration.
- Modify/verify `frontend/app/api/generate/_lib/route-context.ts`: pre-billing availability gate.
- Modify/verify `frontend/app/api/generate/_lib/request-options-byteplus.ts`: profile-backed duration, resolution, aspect ratio, and audio normalization.
- Modify/verify `frontend/app/api/generate/_lib/byteplus-submission.ts`: payload submission and rollback.
- Modify/verify `frontend/server/byteplus-accounting.ts`: provider usage accounting.
- Modify/verify `frontend/config/model-registry.json`: authored publication state only.
- Regenerate `frontend/config/model-runtime.json`, `frontend/config/engine-catalog.json`, `frontend/config/model-roster.json`, `docs/model-roster.json`, `docs/model-roster.csv`, and `docs/model-roster-report.md`.

### Runtime tests

- Modify `tests/byteplus-seedance-profiles.test.ts`.
- Modify `tests/generate-byteplus-submission.test.ts`.
- Modify `tests/generate-route-context.test.ts`.
- Modify `tests/seedance-2-pricing.test.ts`.
- Modify `tests/seedance-2-5-readiness.test.ts`.
- Modify `tests/byteplus-provider-architecture.test.ts` only if a responsibility moves between provider modules.

### Marketing page

- Modify `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/seedance-2-5.ts`: replace the prelaunch template with a standard decision template while keeping pricing and compare sections disabled.
- Modify `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx`: allow Seedance 2.5 quick links in the shared layout.
- Modify `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx`: include Seedance 2.5 in the unbranded-title set and preserve playlist-order media selection.
- Modify `content/models/en/seedance-2-5.json`.
- Modify `content/models/fr/seedance-2-5.json`.
- Modify `content/models/es/seedance-2-5.json`.
- Replace `tests/seedance-2-5-coming-soon.test.ts` with `tests/seedance-2-5-marketing-page.test.ts`.
- Modify `tests/model-page-template-registry.test.ts`.
- Modify `tests/model-decision-content-contract.test.ts`.
- Modify `tests/model-prompting-content-contract.test.ts`.
- Modify `tests/model-examples-content-contract.test.ts`.
- Modify `tests/model-page-template-content.test.ts` if the shared content inventory asserts explicit Seedance entries.

### Operational data and handoff

- Update `docs/model-launch/seedance-2-5.md`: real failure/refund proof, audio proof, quote/usage summary, sanitized asset acceptance ledger, playlist/page verification, and remaining launch gates.
- Create the public database playlist `examples-seedance-2-5` through the existing admin playlist workflow; do not store its database ID in Git.
- Curate accepted jobs through existing moderation and playlist admin workflows; do not hardcode generated job IDs in source.

---

### Task 1: Stabilize and commit the existing hidden Seedance 2.5 baseline

**Files:**
- Modify/verify: all files listed under “Existing hidden-runtime baseline”
- Test: `tests/seedance-2-5-readiness.test.ts`
- Test: `tests/seedance-2-5-coming-soon.test.ts`
- Test: `tests/byteplus-seedance-profiles.test.ts`
- Test: `tests/generate-byteplus-submission.test.ts`
- Test: `tests/generate-route-context.test.ts`
- Test: `tests/seedance-2-pricing.test.ts`

**Interfaces:**
- Consumes: current uncommitted Seedance 2.5 hidden-runtime diff already present on `main`.
- Produces: a reviewed commit in which `seedance-2-5` resolves internally, remains absent from `getBaseEngines()`, fails closed by default, and keeps every public execution/discovery surface disabled.

- [ ] **Step 1: Inspect the baseline without changing it**

Run:

```bash
git status --short --branch
git diff -- docs/model-launch/seedance-2-5.md frontend/config/model-registry.json frontend/src/config/fal-engines/seedance-2-5.ts frontend/src/server/video-providers/byteplus-modelark-profiles.ts frontend/app/api/generate/_lib/route-context.ts frontend/server/byteplus-accounting.ts
```

Expected: the current branch is `main`; the Seedance 2.5 diff contains the factual `dreamina-seedance-2-5-260628` identity, disabled-by-default route, administrator-only policy, t2v-only execution, 4–30 seconds, 480p/720p, 16:9, 24 FPS, dedicated rates, and closed public surfaces. Stop if unrelated changes overlap any listed file.

- [ ] **Step 2: Run the focused hidden-runtime contract suite**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-readiness.test.ts tests/seedance-2-5-coming-soon.test.ts tests/byteplus-seedance-profiles.test.ts tests/generate-byteplus-submission.test.ts tests/generate-route-context.test.ts tests/seedance-2-pricing.test.ts
```

Expected: all tests PASS. Do not continue to paid work if any kill-switch, pre-billing, pricing, or publication assertion fails.

- [ ] **Step 3: Verify every generated model projection**

Run:

```bash
pnpm model:registry:generate
pnpm engine:catalog
pnpm model:generate:write
pnpm model:registry:check
pnpm model:check
pnpm models:audit
```

Expected: generated projections match `frontend/config/model-registry.json`; model audit has no new critical issue.

- [ ] **Step 4: Verify exposure and formatting**

Run:

```bash
npm run lint:exposure
git diff --check
```

Expected: PASS with no public-secret exposure and no whitespace errors.

- [ ] **Step 5: Commit only the reviewed hidden-runtime baseline**

Stage the exact Seedance baseline paths reported by `git status`, including the generated projections, but excluding this plan/spec documentation if already committed and excluding unrelated files. Then run:

```bash
git diff --cached --name-status
git diff --cached --check
git commit -m "feat: add hidden Seedance 2.5 ModelArk runtime"
```

Expected: one focused baseline commit. The working tree may still contain unrelated user changes, but none are included in the commit.

---

### Task 2: Prove a real provider failure refunds exactly once

**Files:**
- Modify: `docs/model-launch/seedance-2-5.md`
- Test: `tests/generate-byteplus-submission.test.ts`
- Verify: `frontend/app/api/generate/_lib/payment-rollback.ts`
- Verify: `frontend/src/lib/schema/billing-receipts-schema.ts`

**Interfaces:**
- Consumes: the hidden administrator route from Task 1 and the unique refund index `app_receipts_unique_refund_job`.
- Produces: sanitized evidence that a real provider rejection after wallet reservation yields one failed job, one charge receipt, one refund receipt, and the original wallet balance.

- [ ] **Step 1: Re-run the deterministic rollback tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/generate-byteplus-submission.test.ts tests/byteplus-provider-architecture.test.ts
```

Expected: the mocked provider failure test passes and calls `rollbackPendingPayment` exactly once.

- [ ] **Step 2: Start the local app with an intentionally invalid dedicated model ID**

In a local-only environment, set only these temporary values:

```text
BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID=dreamina-seedance-2-5-refund-canary-invalid
SEEDANCE_2_5_BYTEPLUS_ENABLED=true
SEEDANCE_2_5_PROVIDER=byteplus_modelark
SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=true
SEEDANCE_2_5_BYTEPLUS_MODES=t2v
```

Do not write these values to `.env*`, deployment settings, the launch packet, or Git. Keep the real ModelArk API credential unchanged and private so the rejection comes from the real provider.

- [ ] **Step 3: Submit one minimum-cost harmless request through MaxVideoAI**

Use the authenticated administrator workspace and submit:

```json
{
  "engine": "seedance-2-5",
  "mode": "t2v",
  "prompt": "A single blue paper boat rests on a clean white table, locked camera, soft daylight, no text.",
  "duration": 4,
  "resolution": "480p",
  "aspect_ratio": "16:9",
  "generate_audio": false
}
```

Expected: MaxVideoAI creates the wallet reservation/job, the provider rejects the invalid model identity, the job becomes `failed`, and the user-facing response contains no provider implementation details.

- [ ] **Step 4: Verify exactly-once accounting**

Take the returned MaxVideoAI job ID from the local response and use it only as a bound SQL parameter in the private database console:

```sql
SELECT status, payment_status, final_price_cents, currency
FROM app_jobs
WHERE job_id = $1;

SELECT type, COUNT(*) AS receipt_count, SUM(amount_cents) AS amount_cents
FROM app_receipts
WHERE job_id = $1
GROUP BY type
ORDER BY type;
```

Expected:

```text
app_jobs.status = failed
app_jobs.payment_status = refunded_wallet
charge receipt count = 1
refund receipt count = 1
charge amount = refund amount
wallet balance after failure = wallet balance before submission
```

Call the job-status endpoint twice more and repeat the receipt query. Expected: refund receipt count remains exactly `1` because the unique partial index and rollback path are idempotent.

- [ ] **Step 5: Restore safe values before any other request**

Stop the server, remove the temporary invalid model-ID override, and restore:

```text
SEEDANCE_2_5_BYTEPLUS_ENABLED=false
SEEDANCE_2_5_PROVIDER=disabled
SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=true
SEEDANCE_2_5_BYTEPLUS_MODES=t2v
```

Restart and verify a valid administrator request returns `BYTEPLUS_ENGINE_DISABLED` before database or billing access.

- [ ] **Step 6: Record only sanitized proof and commit it**

Add the date, request shape, failed/refunded states, receipt counts, equal charge/refund amount, and restored safe defaults to `docs/model-launch/seedance-2-5.md`. Do not record the job ID, provider request ID, API response body, signed URL, wallet ID, or credential.

Run:

```bash
git diff --check -- docs/model-launch/seedance-2-5.md
git add docs/model-launch/seedance-2-5.md
git commit -m "docs: record Seedance 2.5 refund canary"
```

---

### Task 3: Enable the dedicated Seedance 2.5 audio contract with TDD

**Files:**
- Modify: `frontend/src/server/video-providers/byteplus-modelark-profiles.ts`
- Modify: `frontend/src/config/fal-engines/seedance-2-5.ts`
- Modify: `tests/byteplus-seedance-profiles.test.ts`
- Modify: `tests/seedance-2-5-readiness.test.ts`
- Modify: `tests/generate-byteplus-submission.test.ts`
- Modify: `tests/seedance-2-pricing.test.ts`
- Regenerate: `frontend/config/engine-catalog.json`
- Regenerate: `frontend/config/model-roster.json`
- Regenerate: `docs/model-roster.json`
- Regenerate: `docs/model-roster.csv`
- Regenerate: `docs/model-roster-report.md`

**Interfaces:**
- Consumes: `BytePlusSeedanceProfile.generatedAudio`, `normalizeBytePlusOptions`, and `buildBytePlusSeedancePayload`.
- Produces: Seedance 2.5 accepts explicit `generate_audio: true` or `false`; the normalized engine advertises audio; the submission payload carries the selected value; the existing canonical quote remains USD 8.67 for the 15-second 720p request because audio is not a pricing-context dimension.

- [ ] **Step 1: Write the failing profile and runtime assertions**

Change the Seedance 2.5 expectations in `tests/byteplus-seedance-profiles.test.ts` to:

```ts
assert.equal(profile.generatedAudio, true);
assert.equal(runtime.audio, true);
assert.deepEqual(
  normalizeBytePlusOptions({
    engineId: 'seedance-2-5',
    durationSec: 15,
    requestedResolution: '720p',
    aspectRatio: '16:9',
  }),
  {
    ok: true,
    durationSec: 15,
    resolution: '720p',
    aspectRatio: '16:9',
    generatedAudio: true,
  },
);
```

Change `tests/seedance-2-5-readiness.test.ts` to assert:

```ts
assert.equal(profile.generatedAudio, true);
assert.equal(getFalEngineById(slug)?.engine.audio, true);
```

- [ ] **Step 2: Add a failing payload-propagation test**

Add a table-driven test in `tests/generate-byteplus-submission.test.ts` using the existing `baseParams`, temporary enabled flags, and dependency injection. Run it for `audioEnabled: true` and `audioEnabled: false`, capture the `generateAudio` argument passed to `buildBytePlusSeedancePayloadFn`, and assert:

```ts
assert.deepEqual(capturedGenerateAudioValues, [true, false]);
assert.equal(providerRequests, 2);
assert.equal(rollbacks, 0);
```

The stubbed provider returns `{ providerJobId: 'audio-contract-job', status: 'queued' }`; the test must restore every environment value and `console.warn` in `finally`.

- [ ] **Step 3: Add a failing audio-capability and quote-stability assertion**

In `tests/seedance-2-pricing.test.ts`, add a 15-second, 720p, 16:9 member snapshot assertion. Do not add `hasAudio` to `PricingContext`; audio is carried by generation settings, not by the canonical video-pricing interface.

```ts
const engine = getEngine('seedance-2-5');
const snapshot = await computePricingSnapshot({
  engine,
  durationSec: 15,
  resolution: '720p',
  aspectRatio: '16:9',
  membershipTier: 'member',
});

assert.equal(engine.audio, true);
assert.equal(snapshot.totalCents, 867);
```

- [ ] **Step 4: Run the red tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/byteplus-seedance-profiles.test.ts tests/seedance-2-5-readiness.test.ts tests/generate-byteplus-submission.test.ts tests/seedance-2-pricing.test.ts
```

Expected: FAIL because Seedance 2.5 still declares `generatedAudio: false` and `engine.audio: false`.

- [ ] **Step 5: Implement the minimal dedicated capability change**

In `frontend/src/server/video-providers/byteplus-modelark-profiles.ts`, change only the Seedance 2.5 profile field:

```ts
generatedAudio: true,
```

In `frontend/src/config/fal-engines/seedance-2-5.ts`, change:

```ts
audio: true,
```

and:

```ts
audioToggle: true,
notes: 'Hidden canary: text-to-video, 4-30s, 480p/720p, 16:9, optional generated audio.',
```

Do not add references, editing, extension, motion controls, extra aspect ratios, 1080p, or 4K.

- [ ] **Step 6: Run the green tests and regenerate projections**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/byteplus-seedance-profiles.test.ts tests/seedance-2-5-readiness.test.ts tests/generate-byteplus-submission.test.ts tests/seedance-2-pricing.test.ts
pnpm engine:catalog
pnpm model:generate:write
pnpm model:registry:check
git diff --check
```

Expected: PASS. Generated catalogs show audio support for the hidden engine while every public publication flag remains unchanged.

- [ ] **Step 7: Commit the audio contract**

```bash
git add frontend/src/server/video-providers/byteplus-modelark-profiles.ts frontend/src/config/fal-engines/seedance-2-5.ts tests/byteplus-seedance-profiles.test.ts tests/seedance-2-5-readiness.test.ts tests/generate-byteplus-submission.test.ts tests/seedance-2-pricing.test.ts frontend/config/engine-catalog.json frontend/config/model-roster.json docs/model-roster.json docs/model-roster.csv docs/model-roster-report.md
git diff --cached --check
git commit -m "feat: validate optional Seedance 2.5 audio"
```

---

### Task 4: Generate and accept the approved 2 + 1 asset pack

**Files:**
- Modify after acceptance: `docs/model-launch/seedance-2-5.md`
- Read-only source: `docs/superpowers/specs/2026-08-07-seedance-2-5-marketing-video-launch-design.md`

**Interfaces:**
- Consumes: administrator-only Seedance 2.5 route, exact prompts below, wallet preflight, provider poller, durable output copier, moderation UI.
- Produces: two accepted 24-second hero jobs and, if safe, one accepted 15-second dialogue/audio job, each with durable video, preview, poster, actual usage, receipt, and QA disposition.

- [ ] **Step 1: Prepare the paid canary environment**

Use the factual model ID and enable only:

```text
BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID=dreamina-seedance-2-5-260628
SEEDANCE_2_5_BYTEPLUS_ENABLED=true
SEEDANCE_2_5_PROVIDER=byteplus_modelark
SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=true
SEEDANCE_2_5_BYTEPLUS_MODES=t2v
```

Verify a non-administrator request still returns 401 with no job or provider task. Record the current provider-cost total and wallet balance privately before generation.

- [ ] **Step 2: Generate “The city in the suitcase” once**

Request 24 seconds, 720p, 16:9, audio off, using this exact prompt:

```text
Cinematic 24-second landscape video, 16:9. A woman in her early thirties waits alone on a quiet European railway platform at sunrise. She wears a timeless camel coat and places a weathered brown suitcase on the ground. Maintain her appearance, clothing, the suitcase design, and the platform architecture consistently throughout the video.

0-4 seconds: medium-low camera angle. She opens the suitcase. A warm golden light immediately illuminates her face from inside. The camera begins one slow, continuous forward dolly toward the open suitcase.

4-17 seconds: inside the suitcase, a realistic miniature coastal city unfolds and comes alive in one continuous action: compact buildings rise, a small train moves along the coast, tiny cars begin moving, harbor water ripples, and waves reach the shore. The camera continues the same smooth forward movement and descends into the city. Preserve believable scale, geometry, gravity, and natural motion. No sudden transformation, no cut, no change of visual style.

17-24 seconds: the camera gently rises into a wide view showing the complete living coastal city still contained inside the open suitcase. The woman remains visible beyond it at giant scale, watching in quiet amazement. Golden sunrise, subtle sea mist, realistic materials, cinematic contrast, premium feature-film photography. End on a stable, readable composition with no text, no logo, and no watermark.
```

Expected preflight member quote: USD 13.87. Stop before submission if the quote is materially different.

- [ ] **Step 3: Generate “The glass lightning train” once**

Request 24 seconds, 720p, 16:9, audio off, using this exact prompt:

```text
Cinematic 24-second landscape video, 16:9. A long matte-black freight train crosses a vast salt desert at high speed during a violent nighttime storm. Maintain the locomotive, wagon count, proportions, direction of travel, and desert horizon consistently throughout the video.

0-4 seconds: the camera tracks extremely low beside the moving wheels. Rain, salt dust, and reflections react naturally to the train's speed. A powerful lightning bolt strikes the ground directly ahead and instantly solidifies into one monumental arch of transparent luminous glass. Strong visual hook in the first second.

4-18 seconds: the train passes through a sequence of glass arches created one by one by lightning strikes. Use one continuous lateral tracking movement. The arches refract blue-white lightning across the black metal train and wet salt surface. Keep the train stable and realistic; no wagon duplication, bending, melting, or direction change.

18-24 seconds: the same camera movement gradually cranes upward into an epic wide aerial reveal. Dozens of luminous glass arches extend toward the horizon while the train continues through the storm. Monumental scale, realistic rain, volumetric clouds, controlled highlights, premium cinematic photography. End on a stable wide composition with no text, no logo, and no watermark.
```

Expected preflight member quote: USD 13.87. Stop before submission if the quote is materially different.

- [ ] **Step 4: Watch and grade both hero outputs before any retry**

Watch every frame at full size. Record pass/fail for:

```text
City: stable woman; stable suitcase; city remains inside suitcase; continuous camera; coherent train/cars/water/buildings; clean final two seconds; no text/logo/anatomy defect.
Train: stable locomotive and wagons; lightning visibly forms a glass arch; train remains visible; continuous lateral tracking; legible aerial payoff; strong silent first two seconds; no duplication/derailment/text/logo.
Technical: 1280×720; 24 FPS; requested duration; audio absent; durable video present; preview present; poster present; HTTP range response works; paid_wallet receipt; actual usage persisted.
```

Do not use the retry yet. First inspect both initial outputs so the single retry goes to the weaker high-value asset.

- [ ] **Step 5: Generate “The runaway sock” as the audio canary**

Request 15 seconds, 720p, 16:9, generated audio on, using this exact prompt:

```text
Cinematic 15-second landscape video, 16:9, with synchronized English dialogue and natural laundromat ambience. Two adults in their early thirties stand near the same washing machine in a stylish late-night laundromat. The woman has short dark hair and wears a green jacket. The man has curly brown hair and wears a navy overshirt. Maintain both faces, clothing, positions, and eyelines consistently. Warm practical lights mix with soft blue neon from the windows. Use one extremely subtle continuous dolly-in; no cuts and no dramatic camera movement.

0-4 seconds: a single red sock falls from the man's laundry basket. The woman picks it up, looks at him, and smiles. Natural hand movement and restrained facial acting.

4-9 seconds: she offers him the red sock and says playfully, "I think your sock is trying to escape." Her mouth movement, expression, voice, and timing match the sentence. The man listens and maintains correct eye contact.

9-15 seconds: he accepts the sock, studies it with mock seriousness, then says, "It always wanted to travel." His mouth movement and expression match the sentence. They share a small natural laugh while the washing machines continue turning behind them. Clear voices, subtle room tone, no music overpowering the dialogue, no subtitles, no text, no logo, and no watermark.
```

Expected preflight member quote: USD 8.67. Verify both dialogue lines, speaker attribution, lip synchronization, hands, faces, eyelines, ambience, and durable audio playback. If the request contract fails, reconcile/refund it and omit the asset instead of changing runtime scope during paid production.

- [ ] **Step 6: Use the single authorized retry only if it changes launch quality**

Choose exactly one of these actions after comparing all initial outputs:

```text
No retry: all required acceptance criteria pass.
Retry City: the concept is legible but one fixable continuity or geometry defect blocks use.
Retry Train: the concept is legible but train consistency or the final reveal blocks use.
Retry Dialogue: audio works but one fixable speaker, lip-sync, handoff, or intelligibility defect blocks use.
```

Use the same duration, resolution, aspect ratio, audio state, and core prompt. Change only the failing instruction. Before submitting, confirm the cumulative provider estimate remains at or below USD 20.11. No second retry is allowed.

- [ ] **Step 7: Restore safe defaults immediately after the final task reaches a terminal state**

Restore:

```text
SEEDANCE_2_5_BYTEPLUS_ENABLED=false
SEEDANCE_2_5_PROVIDER=disabled
SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=true
SEEDANCE_2_5_BYTEPLUS_MODES=t2v
```

Keep polling/storage workers active until every submitted job completes, fails, or refunds. Verify a new administrator request is rejected before billing.

- [ ] **Step 8: Record the sanitized acceptance ledger and commit it**

In `docs/model-launch/seedance-2-5.md`, record for each concept: accepted/rejected, duration, resolution, FPS, audio state, quote, actual usage/cost, durable-copy result, poster/preview result, and acceptance notes. Do not write job IDs, provider task IDs, signed URLs, user IDs, or wallet IDs.

```bash
git add docs/model-launch/seedance-2-5.md
git diff --cached --check
git commit -m "docs: record Seedance 2.5 marketing renders"
```

---

### Task 5: Promote the route to the standard noindex model-page template

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/seedance-2-5.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx`
- Modify: `content/models/en/seedance-2-5.json`
- Modify: `content/models/fr/seedance-2-5.json`
- Modify: `content/models/es/seedance-2-5.json`
- Delete: `tests/seedance-2-5-coming-soon.test.ts`
- Create: `tests/seedance-2-5-marketing-page.test.ts`
- Modify: `tests/model-page-template-registry.test.ts`
- Modify: `tests/model-decision-content-contract.test.ts`
- Modify: `tests/model-prompting-content-contract.test.ts`
- Modify: `tests/model-examples-content-contract.test.ts`

**Interfaces:**
- Consumes: accepted playlist media from Task 4 and the existing strict `decision`, `prompting`, and `examples` parsers.
- Produces: Seedance 2.5 renders through `MarketingModelPageLayout`, shows real accepted media, exposes no generation/pricing CTA, remains `noindex, follow`, and keeps all discovery flags closed.

- [ ] **Step 1: Replace the prelaunch assertions with failing marketing-page assertions**

Create `tests/seedance-2-5-marketing-page.test.ts` with these core expectations:

```ts
test('Seedance 2.5 uses the shared decision template while launch surfaces stay closed', () => {
  const model = getRuntimeModelById('seedance-2-5');
  const template = getModelPageTemplateConfig('seedance-2-5');

  assert.ok(model);
  assert.ok(template);
  assert.equal(template.intent, 'production');
  assert.equal(isPrelaunchModelPageTemplateSlug('seedance-2-5'), false);
  assert.equal(template.pricing.enabled, false);
  assert.equal(template.sections.examples, true);
  assert.equal(template.sections.prompting, true);
  assert.equal(template.sections.tips, true);
  assert.equal(template.sections.compare, false);
  assert.equal(template.sections.specs, true);
  assert.doesNotMatch(JSON.stringify(template), /\/app\?engine=seedance-2-5/i);

  assert.equal(model.publication.model.indexable, false);
  assert.equal(model.publication.app.published, false);
  assert.equal(model.publication.pricing.published, false);
  assert.equal(model.publication.examples.published, false);
  assert.equal(model.publication.compare.published, false);
  assert.equal(model.publication.sitemap.published, false);
});
```

Add a locale loop that parses `decision`, `prompting`, and `examples`, asserts their `modelSlug` is `seedance-2-5`, and rejects public copy containing `BytePlus`, `ModelArk`, `provider`, `canary`, `unconfirmed`, or internal prices.

- [ ] **Step 2: Update executable-content inventory expectations**

Change the explicit executable-model count from `40` to `41` in:

```text
tests/model-decision-content-contract.test.ts
tests/model-prompting-content-contract.test.ts
tests/model-examples-content-contract.test.ts
```

In `tests/model-examples-content-contract.test.ts`, change the per-locale empty-state expectation from `{ true: 35, false: 5 }` to `{ true: 35, false: 6 }`, and the total from `{ true: 105, false: 15 }` to `{ true: 105, false: 18 }` because Seedance 2.5 uses `showWhenEmpty: false`.

Add `seedance-2-5` to the explicit production-template list in `tests/model-page-template-registry.test.ts`.

- [ ] **Step 3: Run the red page/content tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-marketing-page.test.ts tests/model-page-template-registry.test.ts tests/model-decision-content-contract.test.ts tests/model-prompting-content-contract.test.ts tests/model-examples-content-contract.test.ts
```

Expected: FAIL because the template is still `prelaunch` and the localized documents lack strict `decision`, `prompting`, and `examples` blocks.

- [ ] **Step 4: Replace the template with this exact launch-stage configuration**

Set `seedance25TemplateConfig` to:

```ts
export const seedance25TemplateConfig: ModelPageTemplateConfig = {
  slug: 'seedance-2-5',
  intent: 'production',
  hero: {
    eyebrow: 'BYTEDANCE NEXT-GEN VIDEO MODEL',
    subtitleHighlightTerms: ['30-second storytelling', 'cinematic continuity', 'camera control'],
    primaryCtaHref: '/examples/seedance',
    secondaryCtaHref: '/models/seedance-2-0',
    quickLinks: [
      { labelKey: 'seedanceExamples', href: '/examples/seedance', icon: 'examples' },
      { labelKey: 'availableSeedance', href: '/models/seedance-2-0', icon: 'video' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    enabled: false,
    anchorHref: '#specs',
    presets: [],
  },
  sections: {
    examples: true,
    prompting: true,
    tips: true,
    compare: false,
    specs: true,
    safety: true,
    faq: true,
  },
};
```

Add `'seedance-2-5'` to `heroQuickLinkModels` in `MarketingModelPageLayout.tsx` and `UNBRANDED_MODEL_TITLE_SLUGS` in `page.tsx`. Do not add a special layout branch or a hardcoded generated job ID.

- [ ] **Step 5: Replace prelaunch copy with complete localized decision-page content**

Remove `custom.prelaunch` from all three Seedance 2.5 content files. Preserve the exact semantic IDs across EN/FR/ES and add these strict blocks:

```text
decision.modelSlug = seedance-2-5
prompting.modelSlug = seedance-2-5
examples.modelSlug = seedance-2-5
examples.showWhenEmpty = false
examples filter IDs = all, cinematic, audio
examples proof IDs/icons = continuity/users, camera/maximize, physics/zap, dialogue/audio, production/shield
prompting tab IDs = concept, timeline, constraints
```

Use these exact English hero values:

```json
{
  "title": "Seedance 2.5 — cinematic AI video with longer, more controlled scenes",
  "intro": "Explore Seedance 2.5 through real MaxVideoAI renders designed to test 30-second storytelling, camera movement, physical coherence and natural human performance.",
  "badge": "Real MaxVideoAI examples · Up to 30 seconds · 720p",
  "ctaPrimary": {
    "label": "View Seedance examples",
    "href": "/examples/seedance"
  }
}
```

Use these exact French values:

```json
{
  "title": "Seedance 2.5 — vidéo IA cinématographique pour des scènes plus longues et mieux contrôlées",
  "intro": "Découvrez Seedance 2.5 à travers de vrais rendus MaxVideoAI conçus pour tester la narration longue, les mouvements de caméra, la cohérence physique et le jeu naturel des personnages.",
  "badge": "Exemples réels MaxVideoAI · Jusqu’à 30 secondes · 720p",
  "ctaPrimary": {
    "label": "Voir les exemples Seedance",
    "href": "/fr/galerie/seedance"
  }
}
```

Use these exact Spanish values:

```json
{
  "title": "Seedance 2.5 — vídeo con IA cinematográfico para escenas más largas y controladas",
  "intro": "Descubre Seedance 2.5 mediante renders reales de MaxVideoAI diseñados para probar narración larga, movimiento de cámara, coherencia física e interpretación humana natural.",
  "badge": "Ejemplos reales de MaxVideoAI · Hasta 30 segundos · 720p",
  "ctaPrimary": {
    "label": "Ver ejemplos de Seedance",
    "href": "/es/galeria/seedance"
  }
}
```

The `decision` blocks must use the same CTA destinations and include:

```text
features: 30-second storytelling, camera continuity, physical coherence, human performance
decision cards: cinematic storytelling, commercial concepts, human scenes
referenceWorkflows: text-first scene planning, timed beat direction
pricingCopy CTA: the localized Seedance examples route, not pricing or app
media badges: 24s, 720p, 16:9 for hero media; audio state comes from runtime media
```

The `prompting.demo` block uses the accepted second hero video through playlist order and contains `audioChipMode: "media"`. The `examples` section title describes real Seedance 2.5 outputs; `defaultCtaLabel` points to the Seedance family gallery; `recreateLabel` is `null` while public generation is closed.

Do not state that the accepted renders prove references, editing, extension, 4K, 1080p, or 180-second output. Do not mention providers, pricing uncertainty, canaries, or rollout mechanics.

- [ ] **Step 6: Run the green content and architecture tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-marketing-page.test.ts tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts tests/model-decision-content-contract.test.ts tests/model-prompting-content-contract.test.ts tests/model-examples-content-contract.test.ts tests/model-examples-view-model.test.ts tests/model-page-layout-architecture.test.ts
pnpm models:audit
pnpm --prefix frontend run i18n:check
pnpm --prefix frontend run seo:check
git diff --check
```

Expected: all tests PASS; `listPrelaunchModelPageTemplateSlugs()` is empty; all 41 executable models have strict EN/FR/ES decision, prompting, and examples content.

- [ ] **Step 7: Commit the standard noindex model page**

```bash
git add frontend/app/'(localized)'/'[locale]'/'(marketing)'/models/'[slug]'/_lib/model-page-templates/seedance-2-5.ts frontend/app/'(localized)'/'[locale]'/'(marketing)'/models/'[slug]'/_components/MarketingModelPageLayout.tsx frontend/app/'(localized)'/'[locale]'/'(marketing)'/models/'[slug]'/page.tsx content/models/en/seedance-2-5.json content/models/fr/seedance-2-5.json content/models/es/seedance-2-5.json tests/seedance-2-5-coming-soon.test.ts tests/seedance-2-5-marketing-page.test.ts tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts tests/model-decision-content-contract.test.ts tests/model-prompting-content-contract.test.ts tests/model-examples-content-contract.test.ts
git diff --cached --check
git commit -m "feat: add Seedance 2.5 marketing model page"
```

---

### Task 6: Publish accepted assets to the dedicated model playlist

**Files:**
- No source file required for playlist creation or moderation.
- Verify: `frontend/server/example-family-playlists.ts`
- Verify: `frontend/server/videos.ts`
- Verify: `frontend/server/playlists/mutations.ts`
- Test: `tests/model-examples-view-model.test.ts`
- Test: `tests/models-audit-examples-contract.test.ts`

**Interfaces:**
- Consumes: accepted durable jobs from Task 4 and the model page from Task 5.
- Produces: public/indexable accepted videos in the public `examples-seedance-2-5` playlist, ordered so the strongest playable hero is selected first and the second hero becomes the prompting demo.

- [ ] **Step 1: Confirm the playlist-based selection contract**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-examples-view-model.test.ts tests/models-audit-examples-contract.test.ts
```

Expected: PASS. `page.tsx` loads `examples-seedance-2-5`, filters by the Seedance 2.5 engine ID, and `pickHeroMedia`/`pickDemoMedia` select playable items without hardcoded IDs.

- [ ] **Step 2: Moderate only accepted jobs**

In the authenticated admin moderation interface, set each accepted Seedance 2.5 job to:

```text
visibility = public
indexable = true
engine_id = seedance-2-5
durable video URL present
durable preview URL present
thumbnail/poster URL present
```

Leave rejected, failed, malformed, or superseded attempts private and non-indexable. Do not delete them; retain billing/audit history.

- [ ] **Step 3: Create the exact model playlist**

In the admin playlist interface, create:

```text
name: Model · Seedance 2.5
slug: examples-seedance-2-5
description: Drives /models/seedance-2-5.
public: true
```

Do this manually because `publication.examples.published` intentionally remains false during the noindex launch stage; do not open family discovery just to make the helper card appear.

- [ ] **Step 4: Curate the order**

Order accepted items as:

```text
1. Strongest hero: primary model-page autoplay media
2. Other 24-second hero: prompting demo and first alternate example
3. Runaway sock: human/dialogue proof, only if accepted
```

Save the playlist and reload it. Because the server query orders by `order_index DESC`, verify the first API/page result is the intended hero. If the admin visual order and server order differ, reverse the saved item order once and recheck; do not add a page-specific source-code exception.

- [ ] **Step 5: Verify direct-page and watch-page media**

Open the English, French, and Spanish Seedance 2.5 pages. Expected:

```text
hero uses the first accepted playlist video
prompting demo uses the second accepted playlist video
examples section contains only accepted Seedance 2.5 jobs
dialogue item shows Audio on; silent heroes show Audio off
every poster loads before video playback
every View render link opens a public watch page
every Recreate link remains a marketing/examples destination while app publication is closed
no autoplay audio
```

- [ ] **Step 6: Re-run the examples contracts**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-examples-architecture.test.ts tests/model-examples-content-contract.test.ts tests/model-examples-view-model.test.ts tests/models-audit-examples-contract.test.ts
```

Expected: PASS. No Git commit is required for database-only curation.

---

### Task 7: Run final browser, SEO, build, and handoff verification

**Files:**
- Modify: `docs/model-launch/seedance-2-5.md`
- Verify: all files changed in Tasks 1–6

**Interfaces:**
- Consumes: committed hidden runtime/audio/page changes and curated database media.
- Produces: a sanitized go/no-go record for the noindex marketing page, with broader launch work explicitly left closed.

- [ ] **Step 1: Run focused and broad automated verification**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-readiness.test.ts tests/seedance-2-5-marketing-page.test.ts tests/byteplus-seedance-profiles.test.ts tests/generate-byteplus-submission.test.ts tests/seedance-2-pricing.test.ts tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts tests/model-decision-content-contract.test.ts tests/model-prompting-content-contract.test.ts tests/model-examples-content-contract.test.ts tests/model-examples-view-model.test.ts
pnpm model:registry:check
pnpm model:check
pnpm models:audit
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
npm --prefix frontend run lint
npm run lint:exposure
pnpm --prefix frontend run i18n:check
pnpm --prefix frontend run seo:check
pnpm --prefix frontend exec tsc --noEmit --pretty false
git diff --check
```

Expected: PASS. Any pre-existing unrelated failure must be isolated with evidence before proceeding; no Seedance-specific failure may be waived.

- [ ] **Step 2: Build the production application**

```bash
pnpm --prefix frontend run build
```

Expected: successful Next.js production build with all localized Seedance 2.5 static params generated.

- [ ] **Step 3: Smoke-test localized pages in the browser**

Verify:

```text
/models/seedance-2-5
/fr/modeles/seedance-2-5
/es/modelos/seedance-2-5
```

For each route check:

```text
HTTP 200
shared MarketingModelPageLayout, not MarketingModelPrelaunchPageLayout
self-canonical localized URL
complete hreflang set
robots noindex, follow
no sitemap inclusion
WebPage/Breadcrumb/Product schema matches the shared noindex decision-page policy and contains no published Offer price
hero and poster visible without layout shift
video begins muted and can be paused
examples order matches playlist
prompt copy is readable
no app-generation CTA
no public pricing CTA
no provider or rollout jargon
mobile and desktop layout remain usable
```

- [ ] **Step 4: Update the operational handoff**

In `docs/model-launch/seedance-2-5.md`, add:

```text
marketing pack acceptance count
dialogue/audio acceptance state
final provider-cost total and retry count
durable media/preview/poster verification
public moderation state
examples-seedance-2-5 playlist readiness
EN/FR/ES page smoke result
automated command results
remaining closed flags: app, pricing, examples-family publication, compare, sitemap, indexation
next separate work: Benchmark Lab score, VS pages, internal linking, homepage promotion, public generation/pricing/indexation
```

Keep the evidence sanitized and omit all private identifiers.

- [ ] **Step 5: Commit the final handoff**

```bash
git add docs/model-launch/seedance-2-5.md
git diff --cached --check
git commit -m "docs: complete Seedance 2.5 marketing handoff"
```

- [ ] **Step 6: Report the exact stopping point**

Report:

```text
accepted video count and titles
provider cost and retry count
audio canary result
playlist and localized page status
test/build status
current commit list
flags that remain closed
explicit statement that no deployment, public generation, pricing, comparison, sitemap, or indexation was performed
```

Do not start the separate scoreboard/VS/linking/public-launch work until the product owner explicitly approves that next plan.
