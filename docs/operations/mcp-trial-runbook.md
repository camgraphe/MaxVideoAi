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
| `completed` with a usable stored output | Ask the central Task 7 outcome owner to consume the reservation. |
| Definitive `failed`, `error`, or cancellation state with no output | Ask the central Task 7 outcome owner to release the reservation. |
| Pending, queued, running, processing, or accepted | Retain the reservation and count it as active. |
| Timeout, stalled, unknown, completed without output, or output/state mismatch | Retain the reservation and count it as ambiguous. |
| Missing job or inconsistent quote/job ownership | Retain the reservation and count it for quarantine/manual inspection. |

The Task 7 transaction is always the final authority after classification.
Concurrent or duplicate runs are idempotent. A classification race is counted
as deferred; it never causes a guessed release. Quarantine is an aggregate
operational result, not a new entitlement state.

If the entitlement, quote, job, risk, or provider-attempt tables are missing,
the cron and admin reads report an explicit unavailable state. Missing schema
must never be displayed as zero activity.

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

MCP trial risk events have a documented retention period of 30 days. Use the
existing bounded privileged cleanup path; never export raw fingerprint or
request context for routine support work.

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
5. For one affected user, use exact user inspection. Never paste a prompt,
   output URL, risk fingerprint, or provider response into the inspector.
6. If containment is needed, keep the checked-in gate false and set
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

This runbook authorizes inspection and local code verification only. It does
not authorize deployment, live database changes, provider calls, public flag
changes, or production/staging mutations.
