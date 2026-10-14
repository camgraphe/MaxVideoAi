# Turnstile widget migration and payment-free validation

Prepared 2026-10-15. This change prepares compatibility; it does not change deployed keys, Cloudflare settings, nameservers or payment configuration.

## Compatibility contract

The browser's `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is fixed at build time. An open tab continues generating tokens for that widget after a new deployment. The hosted request helper and Express component now send `captchaSiteKey`, identifying the widget that produced the token. Both Billing and the workspace use the hosted hook; Billing also passes its rendered key into Express.

For each new guard evaluation, the server selects exactly one configured secret. An old request **without** `captchaSiteKey` selects the legacy widget. An explicit empty, malformed or unknown identifier is rejected, never treated as an old request. There is no trial of a second secret after a failed validation. The existing Express reuse path can return an already authorized session before a new guard evaluation; it preserves that same session, its history and its protections without creating a new session or resetting limits.

`frontend/server/turnstile-widgets.ts` owns the registry. `checkout-guard.ts` retains policy and the global token claim. The existing unique index from migration 68 remains required; no schema migration or reset accompanies this change. Token identity is global across widgets, users, processes and checkout modes. Provider acceptance alone cannot authorize a duplicate token.

Partial/ambiguous registry configuration produces `captcha_configuration_error` instead of disabling the CAPTCHA. The pre-existing intentionally disabled mode and entirely empty local configuration still behave as before when no migration is configured. A migration combined with a disabled mode is invalid. Hard rate limits and failed-card cooldown retain priority over configuration/widget errors.

## Configuration phases

Do not apply this table until the configuration change and release are explicitly authorized.

| Variable | Current single widget | Compatibility deployment D1 | Cutover deployment D2 |
| --- | --- | --- | --- |
| `TURNSTILE_SECRET_KEY` | Secret A | A, unchanged | A, unchanged |
| `TURNSTILE_LEGACY_SITE_KEY` | Absent | Public key A | A |
| `TURNSTILE_SECONDARY_SITE_KEY` | Absent | Public key B | B |
| `TURNSTILE_SECONDARY_SECRET_KEY` | Absent | Secret B | B |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | A | A | B, requiring a new build |
| `CHECKOUT_CAPTCHA_MODE` | Existing policy | Preserve enabled policy | Same |
| `TURNSTILE_DIAGNOSTICS_ENABLED` | Absent/off | `1` only for an authorized diagnostic deployment | As authorized |

All three migration variables must be configured together. The public keys must be distinct and each mapped to its own secret. Keep the old secret in its existing variable throughout compatibility; retrieving a Vercel Secret later is not a backup plan. Verify recovery from the old widget's owning account or an approved secret store before eventually replacing it.

Production references observed before this PR: public A `0x4AAAAAADKVLDSVtZcPUJ49`; target public B `0x4AAAAAAFUlBaCAy2afBPkH`, widget “MaxVideoAI Production Checkout” in `admin@maxvideoai.com`. No secrets belong in this document, commits, logs or browser output.

## Diagnostic page and endpoint

- Page: `/admin/turnstile-diagnostic`.
- POST: `/api/admin/turnstile-diagnostic`.
- Both require the existing administrator authorization and `TURNSTILE_DIAGNOSTICS_ENABLED=1`. The switch is off by default. The page is dynamically rendered under the private admin layout; API responses are `private, no-store`.
- POST requires the exact same Origin, rejects cross-site fetches, requires JSON and reads at most 4096 bytes. Only a token (1–2048 characters), optional widget identifier and `hosted`/`express_checkout` mode are accepted. Client-supplied user IDs, amounts or metadata are rejected.
- The handler uses the authorized actor's ID, a synthetic 1700-cent custom-amount policy input and first-top-up challenge classification. This is **not a charge**. It calls the real guard and immediately returns the decision.
- The only writes are `checkout_attempts` audit/claim records tagged `metadata.diagnostic='turnstile'`. The session ID remains NULL. There is no Stripe dependency, wallet/receipt mutation or payment-page navigation. Technical attempts can appear in the admin checkout report and are identifiable by their metadata; they do not increment limits that count created Stripe sessions.
- Tokens remain in page memory. The UI neither renders nor stores them in browser storage. “Replay last token” sends the exact last payload, including its original widget identifier and mode. “New challenge” obtains a new token. No validation or challenge is started automatically when the page opens.
- The shared guard still respects actual IP/user rate limits and cooldown. A diagnostic can therefore return 429; do not disable those protections to obtain a green result.

Never use `/billing`, a top-up modal or a successful production `/api/wallet` request as a payment-free diagnostic. Express may prepare a Stripe session on mount, and `/api/wallet` proceeds to payment preparation after the guard permits it.

## Isolated checks

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/turnstile-widget-migration-postgres.test.ts \
  tests/turnstile-diagnostic-route-postgres.test.ts \
  tests/turnstile-old-tabs-browser.test.ts \
  tests/checkout-captcha-replay-postgres.test.ts \
  tests/hosted-wallet-checkout.test.ts \
  tests/wallet-express-checkout-behavior.test.ts
```

The migration/diagnostic tests use disposable PostgreSQL 17 and synthetic A/B pairs. Siteverify is simulated at the network boundary and deliberately accepts replay; the actual application/database must refuse the duplicate. The endpoint tests stub the external administrator-authentication boundary and exercise the actual route, origin/body gates, guard and SQL claims. Bundling rejects payment dependencies.

The browser test runs the real diagnostic component and route in a local HTTP harness. It keeps A and B tabs open through A→B→A configuration changes, omits the identifier for the old payload, checks replay/expiry, blocks unrelated network requests and asserts zero Stripe session IDs. The Cloudflare browser script and provider response are simulated. This is **not** a real Cloudflare or production end-to-end validation. Use `localhost` for this harness; NextRequest normalizes a loopback IP URL to localhost.

Before merge, required Quality CI must pass on the latest head, including selected integration/browser/financial lanes, following `docs/deployment/github-vercel.md` and `docs/engineering/ci-validation.md`.

## Authorized live validation and rollback, later

1. Recheck current main/production. Deliver D1 through the repository's Git/PR/CI path with A public and both secrets available. Record its exact SHA, deployment ID, immutable URL, aliases and configuration. Do not expose B until D1 is READY, validated and eligible for rollback.
2. With a separately authorized live diagnostic session, open the diagnostic page on the permitted hostname. Load A and check “Simulate an old tab”; retain the tab. In a second tab select B normally. Validate each once and replay each: first use must pass, reuse must fail locally. Check a fresh token after rejection. Check server logs and audit rows without exposing tokens or secrets.
3. Authorize the public-key change to B and a new Git-backed build D2. Verify `maxvideoai.com` and `api.maxvideoai.com` both serve its expected SHA. Retest the retained A tab, a new B tab and replay on the diagnostic. Preserve the protections from #430 and subsequent antifraud fixes.
4. If returning to A, target the **recorded compatible D1**, not an arbitrary older deployment. Its server accepts both generations, including B tabs left open after rollback. Verify both aliases and any pinned request routing; separately authorize any necessary routing intervention. Never re-expose deployments predating #430.
5. A Vercel rollback restores the target build/environment; reconcile the project's public key to A before later builds while retaining both secrets. Verify the post-rollback automatic-domain-assignment state before resuming releases. Do not roll back database claims, delete history or drop the unique index.
6. Disable diagnostics after the authorized session with a controlled build as required by deployment environment snapshots. Do not leave a temporary `localhost` hostname or temporary secret file from any separately authorized local session.

The old A-only D0 (`dpl_8NWY5H6XWVLfaniggTBodxPMcEBV`, SHA `a9f5a66c03017e9812dc69fd804de6d635d7f22e`) is a dated reference, not a compatible rollback target for B tabs. Reassess it against any newer production changes before emergency use.

Retirement of A is a separate change, after observing legacy traffic and confirming recovery. A five-minute token lifetime or a 12-hour deployment-skew setting does not expire browser tabs. This PR keeps A accepted; it does not implement automatic migration of pre-existing browser bundles. Indefinitely old tabs may ultimately require a full reload when A is retired.

The previous local live session observed a repeated direct Siteverify probe returning success despite the documented single-use contract; the application replay claim rejected it. Cloudflare analytics also disagreed with observed Siteverify calls. That provider/telemetry discrepancy remains unexplained. Do not remove the local anti-replay guarantee or claim the new production pair has already been tested by this PR.

References: [Cloudflare server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables), [Vercel Skew Protection](https://vercel.com/docs/skew-protection), [Vercel rollback](https://vercel.com/docs/instant-rollback).
