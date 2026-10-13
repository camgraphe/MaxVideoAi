# Seedance 2.5 Edit / LAS release

Reviewed: 2026-10-13. This is the focused Edit release procedure; historical
ModelArk launch evidence remains in `seedance-2-5.md`.

## Release state

This procedure describes the separately guarded LAS candidate. The ModelArk
API documented Edit on October 13; the current alternative qualification is
recorded in [seedance-2-5-modelark-edit.md](seedance-2-5-modelark-edit.md).
`SEEDANCE_2_5_EDIT_TRANSPORT` selects the current path, and LAS tariff authoring
requires an explicit LAS selection. Do not apply this correction to a ModelArk
launch or reinterpret recorded jobs using the current selection.

Edit uses LAS `/api/v1/contents/generations/tasks`; T2V, I2V, Ref2V and Extend
retain ModelArk `/api/v3`. This change prepares execution and accounting, but
does not enable a production provider flag or create a provider task.

The authenticated BytePlus console redirected the LAS service to its beta
access request page on October 13. Production environment metadata contained
neither `BYTEPLUS_LAS_API_KEY` nor `SEEDANCE_2_5_LAS_ENABLED`. A read-only tariff
audit found an active revision-1 grid containing 486 Seedance 2.5 V2V classes,
including 1080p, with ModelArk input-token minimums. Those cells do not establish
LAS readiness. This evidence must be refreshed before release.

Read-only unknown-task lookups using the existing authorized ModelArk credential
returned ModelArk `404 ResourceNotFound` and LAS `401 invalid_api_key`. No provider
POST occurred. The existing valid ModelArk key therefore cannot substitute for
the separate LAS credential.

The implemented release preview was also run against production in a read-only
transaction on October 13. It prepared exactly 324 supported classes at revision
1. For the 4s-source/4s-output 16:9 examples, it showed saved 71/159-cent amounts
and proposed 247/553-cent amounts at 480p/720p. No cells, history or release event
were written. Recompute the fingerprint when an administrator performs release;
this dated preview does not authorize a later mutation.

The public catalogue retains all five authored capabilities and supplies
per-mode runtime availability. Edit source controls, quotes and Generate honor
that status; an existing Edit source stays removable and never changes silently
to reference generation. LAS Edit supports 480p/720p only. The four ModelArk modes
retain their current resolutions. Missing credentials, disabled execution, absent
reviewed customer tariffs, old token-minimum tariff shapes or unverified source
timing refuse new Edit work before provider submission.

## Supplier and customer pricing

The [official LAS Enhanced video generation specification](https://docs.byteplus.com/en/docs/byteplus_las/video_gen_enhanced)
publishes a USD 0.303/second base rate and Seedance 2.5 video-input coefficients
0.406 for 480p and 0.9125 for 720p. Billing includes input plus output video
duration. These are LIST estimates; the supplier invoice remains authoritative.
The ModelArk token rates, token minimums and signed ModelArk discount do not
apply to LAS.

`server/byteplus-las-tariff.ts` owns those facts. Source duration comes from
server-resolved owned originals, not caller duration declarations. Every Edit
source/image/audio reference must identify the current owner's exact stored
original URL; an `originUrl` alias cannot stand in for measured bytes. MCP retains
asset IDs and ordered roles in its execution projection. The saved
transport and input duration govern terminal accounting; reported output
duration and resolution take precedence. Reported tokens remain observational.
Missing terminal facts produce an unavailable supplier estimate, never a
ModelArk or zero-cost fallback. Customer charges and refunds remain the original
stored integer amounts.

The separate authoring operation freezes the existing approved 2.5× launch
policy into literal customer rates: 30.7545 cents/billed second at 480p and
69.121875 cents/billed second at 720p, with final upward cent rounding and no
included source seconds. Runtime pricing reads the authored cells; it does not
recompute retail from the supplier rate or discount.

For a verified 4-second source and 4-second output:

| Resolution | Supplier LIST estimate | Customer quote |
| --- | ---: | ---: |
| 480p | USD 0.984144 | USD 2.47 |
| 720p | USD 2.211900 | USD 5.53 |

New LAS Edit submissions require wallet funding. Direct/platform/trial funding
is refused before billing because its LAS terminal settlement is not qualified.
This does not change payment support for the four ModelArk modes.

## Explicit tariff correction

With new LAS submissions disabled, an authenticated administrator reads
`GET /api/admin/pricing/seedance-las`. Its read-only preview binds the current
revision, open cells, closed history, supported catalogue and supplier/policy
provenance. It shows saved prior amounts separately from proposed prices; an old
below-cost amount is not presented as a valid current LAS quote.

Review all 324 classes (27 output durations × 2 resolutions × 6 ratios).
Unreviewed exact overrides, missing/ambiguous classes and unsupported schema
changes stop the operation. Preparation validates every supplier-cent interval
of each continuous source domain, including fractional sources through 30s.
1080p cells are not edited and are not executable as LAS.

Explicitly confirm the current fingerprint with a same-origin authenticated
`POST /api/admin/pricing/seedance-las` body:

```json
{"confirm":true,"fingerprint":"<exact reviewed 64-character fingerprint>"}
```

The server locks the revision and grid, recomputes the complete preview, and
uses the normal append-only tariff store to replace all 324 classes and insert
one immutable release event atomically. Stale review or any persistence failure
rolls back cells, versions, revision and event together. Other modes, paid
snapshots and unsupported cells are preserved. This operation does not activate
LAS or authorize a generation. Refresh the preview after any tariff revision
change; do not bypass it with SQL updates.

Fresh local initialization has a separate explicit declaration:
`PRICING_RELEASE_SEEDANCE_LAS_POLICY=reviewed_2_5x_las_list`. Its report binds the
supplier facts and multiplier and authors the same 324 literal curves. This is
not required by the active-grid correction above. The initialization verifier
retains all 26,818 original checkpoint identities, including 486 explicit
unavailable checks for old 1080p Edit scenarios. Archived ModelArk retail basis
is reconstructed only for maintenance evidence; it cannot authorize a current
LAS quote or debit.

## Submission and terminal recovery

An owned reservation is locked before charging once. Edit then commits its LAS
transport and submission marker before one POST. A concurrent/replayed call with
the same job uses existing state and cannot send another POST. An accepted task
ID is saved before ancillary writes.

Network errors, HTTP 408/5xx, missing task IDs and accepted-task persistence
failures are uncertain submissions. Their wallet charge is retained and no
automatic retry/refund is allowed. Known task IDs resume polling, including
`provider_polling_stalled`; unknown IDs require provider-side investigation.
Preserve the internal job, provider timing and reservation while investigating.
Do not create another job to simulate a retry.

A definite rejection records durable rejection evidence before the normal
transactional terminal refund. A refund-write outage is retried from that evidence
without another provider call. A provider terminal failure refunds the locked
job's stored amount/currency once, even under concurrent polling. Successful
provider results retain storage-copy retries until durable video/media writes
finish. MCP completion also requires library promotion. A lost quote acceptance
acknowledgement is repaired from the same owned, paid job and accepted LAS task,
with exact engine, mode, amount and currency checks. Durable copied URLs and
accounting allow projection repair after the provider lookup expires.
Submission switches can close while known tasks continue reconciling;
keep the shared `BYTEPLUS_ARK_ENABLED` poll gate and credentials available until
all in-flight jobs finish.

Early Seedance 2.5 configuration refusals emit `route_preflight` metrics and a
safe runtime trace containing canonical engine, mode, transport, HTTP status
and allowlisted reason. No caller job/user ID, prompt, media URL, payment ID,
credential or arbitrary error text enters that trace.

## Final access and canary gate

The guarded code can ship through the normal Git delivery path while new LAS
submissions remain disabled. This publishes truthful Edit availability and the
authenticated tariff operation without authorizing provider work. Activation
is a separate step after the checks below.

1. Obtain LAS access in the existing BytePlus account and its separate server
   credential. Keep the key out of Git, command arguments, logs and screenshots.
   Use existing approved secret provisioning for the intended environment.
2. Validate this committed candidate on an isolated authenticated fixture and
   review the exact production tariff preview. Complete the bounded correction
   while new LAS work is disabled. Verify fresh canonical quotes at fractional
   source boundaries and verify the four ModelArk modes still quote unchanged.
3. Approve a generation budget explicitly before any provider POST. Proposed
   final validation is at most two 480p tasks, each with one measured 4-second
   synthetic source and a 4-second output. LIST estimate totals USD 1.968288;
   proposed supplier budget is USD 2.00. Customer wallet exposure is at most
   USD 4.94 under the prepared policy. No retries, hidden operator evaluation
   loop or extra generation is included. A genuine provider rejection should
   incur no LAS charge, but it still counts against the two-POST limit.
4. Verify one authenticated happy path: exact references, task acceptance,
   polling, durable media/download, one wallet charge and LAS input-plus-output
   supplier reconciliation. Verify a known definitive rejection/failure path
   and one stored-amount refund. Fixtures establish ambiguous-network behavior
   without spending; never deliberately duplicate a live generation to test it.
5. Only after those proofs, configure `SEEDANCE_2_5_LAS_ENABLED=true` and include
   `v2v` in `SEEDANCE_2_5_BYTEPLUS_MODES`, preserving the other allowed modes.
   Credential presence alone is
   insufficient. Do not use the flag to bypass a tariff or canary failure.
6. For both guarded delivery and any subsequent activation deployment, follow
   `docs/deployment/github-vercel.md`: current-main candidate, PR, latest required
   Quality CI, committed `deployment:check`, merge, Git Vercel build, and exact
   merged-commit alignment on both website/API domains. No Desktop checkout
   upload, CLI production upload or manual alias is authorized here.

Close only LAS for rollback: set `SEEDANCE_2_5_LAS_ENABLED=false`, preserve the
credential and shared polling gate, reconcile existing tasks, then review tariff
history if a price recovery is needed. Never recompute or undo a paid snapshot.
Keep the four ModelArk modes and model publication intact.

## Verification owners

The focused suites include `byteplus-las-pricing`, `seedance-edit-availability`,
`generate-preflight-rejection`, `seedance-las-tariff-release`,
`seedance-las-admin-route`, the disposable PostgreSQL LAS tariff release and LAS
reliability tests, plus existing Seedance/BytePlus/workspace contracts. The
required Quality CI selects database/media, browser and exhaustive financial
coverage. Paid canary and production activation evidence remain separate from
fixture success.
