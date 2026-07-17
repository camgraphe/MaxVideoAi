# MCP included trial operations runbook

## Current availability and kill switch

The MCP included trial is not live. The checked-in `trial` publication flag in
`frontend/config/mcp-publication.json` remains `false`, as do the other seven
public MCP flags. Runtime eligibility additionally requires
`MCP_TRIAL_ENABLED=true`; the effective state is the logical AND of the
checked-in flag and that exact runtime value. Setting `MCP_TRIAL_ENABLED` to
any other value stops new trial eligibility but does not delete or release an
existing reservation.

Do not describe the trial as publicly available until the separate launch
process explicitly changes the checked-in gate and completes its release
checks.

## Provider-cost safety gate

Trial quotes use the shared BytePlus accounting owner in
`frontend/server/byteplus-accounting.ts`; they do not infer provider cost from
the public MaxVideoAI price. The exact Seedance Mini trial request is repriced
server-side before risk checks, quote persistence, reservation, or provider
submission. Invalid pricing data, an unsupported trial shape, or a cost above
the ceiling fails closed and makes the trial unavailable.

`MCP_TRIAL_PROVIDER_COST_CEILING_CENTS` is a server-owned emergency ceiling. It
defaults to 25 cents and, when configured, must be a base-10 integer from 1
through 100. Empty, signed, padded, decimal, zero, negative, oversized, or
otherwise invalid values fail closed. Request input cannot override it.

The cost fixture was verified on 2026-07-17 against the official BytePlus
[ModelArk product page](https://www.byteplus.com/en/product/modelark) and
[pricing documentation](https://docs.byteplus.com/ja/docs/ModelArk/1544106) for
`dreamina-seedance-2-0-mini-260615`. For text-to-video without video input, the
documented rate is USD 3.50 per million tokens. At 5 seconds, 480p, and 24 fps,
the accounting formula is:

```text
tokens = width × height × duration seconds × fps ÷ 1024
cost cents = ceil(tokens × USD per million tokens ÷ 1,000,000 × 100)
```

This produces 17 cents for 16:9 (854×480), 17 cents for 9:16 (480×854), and
10 cents for 1:1 (480×480). Audio on or off does not change the documented
no-video rate.

If BytePlus changes the rate or formula, keep the public trial flag off, update
the shared accounting owner and dated fixture, then rerun the complete trial,
confirmation, wallet, and production-build gates. Do not raise the ceiling only
to silence a drift failure; first verify the official source and expected unit
economics.

## Reconciliation schedule and authentication

Vercel is configured to call `/api/cron/mcp-trial-reconcile` every 10 minutes.
GET and POST use the same handler. The handler fails closed unless one of these
explicit credentials is valid:

- `CRON_SECRET`, sent as a Bearer authorization token by the scheduled job;
- `MCP_TRIAL_RECONCILE_TOKEN`, sent locally in
  `x-mcp-trial-reconcile-token`.

Vercel marker headers alone are not accepted. Do not put either token in a URL,
support ticket, browser log, or command history shared with other people.

Reconciliation configuration is server-owned:

- `MCP_TRIAL_RECONCILE_STALE_MINUTES` defaults to 30 minutes and must be an
  integer from 15 through 1,440;
- `MCP_TRIAL_RECONCILE_BATCH_LIMIT` defaults to 50 and must be an integer from
  1 through 100.

An invalid configured value fails the run. Request input cannot change the
threshold or batch limit.

## Decision table

Only entitlements in `reserved` state whose `reserved_at` is older than the
configured threshold enter the bounded batch.

| Durable job evidence | Reconciliation action |
| --- | --- |
| `completed` disposition plus `completed` job state and a usable stored output | Ask the central Task 7 outcome owner to consume the reservation. |
| `definitive_failure` or `canceled` disposition with its matching terminal state and no output | Ask the central Task 7 outcome owner to release the reservation. |
| Pending, queued, running, processing, or accepted | Retain the reservation and count it as active. |
| Timeout, stalled, unknown, completed without output, or output/state mismatch | Retain the reservation and count it as ambiguous. |
| Missing job or inconsistent quote/job ownership | Retain the reservation and count it for quarantine/manual inspection. |

`app_jobs.status = 'failed'` alone is never release evidence. The generic final
persistence path records that state as `unknown`; provider timeouts also record
`timeout`. Only a persistence boundary that has definitive provider evidence
may record `definitive_failure`. A usable output requires the durable
`completed` disposition and a whitespace-free credential-free HTTPS media URL
recognized by the configured MaxVideoAI storage boundary. Signed, query-bearing,
fragment-bearing, or provider-hosted URLs are not durable evidence. If neither
`S3_PUBLIC_BASE_URL` nor the configured S3 bucket identifies the URL, retain the
reservation as ambiguous.

Task 7 persists `accepted`, `unknown`, `timeout`, and `stalled` under the same
job lock used for terminal decisions. These coarse signals can become more
specific but never overwrite `completed`, `definitive_failure`, or `canceled`,
and no callback rewrites a consumed or released entitlement. An authoritative
provider rejection may promote ambiguous evidence to `definitive_failure`;
an ordinary `failed` callback cannot. BytePlus 4xx submission rejection writes
that definitive evidence atomically with failed job status, while an ambiguous
submission failure writes `unknown`.

The Task 7 transaction is always the final authority after classification.
Concurrent or duplicate runs are idempotent. A classification race is counted
as deferred because Task 7 re-reads the disposition under its row lock before
release; it never causes a guessed release. Quarantine is an aggregate
operational result, not a new entitlement state.

If the entitlement, quote, job, risk, or provider-attempt tables, or the trial
disposition column, are missing, the cron and admin reads report an explicit
unavailable state. Missing schema must never be displayed as zero activity.

## Safe output and privacy exclusions

Cron responses and logs contain only aggregate counts, fixed coarse reason
codes, duration, stale threshold, and batch limit. They must not contain user
IDs, job IDs, prompts, media URLs, private pricing snapshots, IP addresses,
user-agent strings, fraud fingerprints, OAuth client IDs, provider payloads,
or authentication tokens.

The admin view may inspect one exact user at a time and shows only bounded
lifecycle state, quote/job state, output presence, and reservation time. It
does not show prompt text, a media URL, an IP or user-agent value, a fingerprint,
an OAuth client identifier, or a private cost snapshot. Aggregate provider
cost comes from authoritative provider attempts rather than the private trial
pricing envelope.

Every authenticated reconciliation run also invokes the privileged risk-event
cleanup with a fixed cutoff of 30 days and a maximum batch of 1,000 rows. Only
events strictly older than the cutoff are deleted. The response exposes only
`available`/`unavailable`, a coarse reason code, the deleted count or `null`,
and the fixed batch limit. Repeated full cleanup batches indicate backlog; they
do not authorize a larger cap. Never export a fingerprint or request context
for routine support work.

The runtime database role used by the authenticated cron must have explicit
`EXECUTE` permission on `cleanup_mcp_trial_risk_events`; public execution stays
revoked. A missing function, table, or privilege reports risk retention as
`unavailable` with a `null` deleted count. It does not turn the reconciliation
aggregate itself into a synthetic failure or authorize a direct delete.

## Incident checks

1. Confirm all eight checked-in publication flags and the runtime
   `MCP_TRIAL_ENABLED` state before interpreting traffic.
2. Check the admin view for explicit availability. Stop if a prerequisite is
   unavailable; do not infer zero usage.
3. Review aggregate reserved, consumed, released, accepted, provider-cost, and
   suspicious-velocity values.
4. Review the latest reconciliation aggregate reason codes and duration. A
   full batch on repeated runs indicates backlog, not permission to increase
   the cap past 100.
5. Review the aggregate risk-retention result. Treat `unavailable` as an
   operational fault, not as zero deleted rows; a repeated 1,000-row batch is a
   retention backlog.
6. For one affected user, use exact user inspection. Never paste a prompt,
   output URL, risk fingerprint, or provider response into the inspector.
7. If containment is needed, keep the checked-in gate false and set
   `MCP_TRIAL_ENABLED=false`. Continue reconciliation so existing reservations
   can reach evidence-backed terminal states.

## Support wording

For an active, missing, or ambiguous job, use:

> Your included trial is still reserved while we verify whether the provider
> produced an output. No wallet credit was used.

For a verified no-output manual release, use:

> We verified that no output was produced and released the included trial for
> another eligible attempt. No wallet credit was used.

Do not promise a release for a timeout, missing job, stalled state, or unknown
provider result. Do not describe an included trial correction as a wallet
refund or wallet credit.

## Manual correction

Manual release is available only to an authenticated administrator through the
same-origin admin server action. Inspect the exact user first. The action
accepts one of these allowlisted reasons:

- `provider_confirmed_no_output`;
- `support_verified_no_output`.

The entitlement must still be reserved, the quote/job identities must agree,
and no output may exist. A consumed or already released entitlement cannot be
overridden.

The correction uses the dedicated Task 7 support seam. Entitlement release,
quote failure, the immutable support audit, and the `admin_audit` entry commit
in one database transaction. If `admin_audit` insertion fails, the release and
support audit roll back. Never substitute the fail-soft `logAdminAction` helper
for this mutation.

## Recovery

1. Restore missing migrations or database connectivity before retrying an
   unavailable read or cron run.
2. Correct invalid reconciliation environment values within the documented
   bounds; do not add request-controlled overrides.
3. Re-run the authenticated endpoint once and compare aggregate counts only.
4. Inspect deferred or quarantined users individually. Release only after
   support has verified that no output exists.
5. Confirm the immutable support audit and matching `admin_audit` row after a
   manual correction.
6. Confirm wallet receipts and balances were not changed by reconciliation or
   included-trial support correction.
7. If risk retention is unavailable, restore the risk table/function privilege
   boundary and retry the authenticated cron. Never replace the bounded cleanup
   with an unbounded direct delete.

This runbook authorizes inspection and local code verification only. It does
not authorize deployment, live database changes, provider calls, public flag
changes, or production/staging mutations.
