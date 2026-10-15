# Turnstile widget migration and payment-free validation

Updated 2026-10-15. Compatibility was delivered in PR 440. This follow-up prepares explicit B-only retirement and user-controlled reload recovery; it does not activate retirement or change deployed keys, Cloudflare settings, nameservers or payment configuration.

## Compatibility contract

The browser's `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is fixed at build time. An open tab continues generating tokens for that widget after a new deployment. The hosted request helper and Express component now send `captchaSiteKey`, identifying the widget that produced the token. Both Billing and the workspace use the hosted hook; Billing also passes its rendered key into Express.

For each new guard evaluation, the server selects exactly one configured secret. In the default `compatibility` mode, an old request **without** `captchaSiteKey` selects the legacy widget. In explicit `secondary_only` mode, widget identity is mandatory and only B is accepted. An explicit empty, malformed or unknown identifier is rejected, never treated as an old request. There is no trial of a second secret after a failed validation. The existing Express reuse path can return an already authorized session before a new guard evaluation; it preserves that same session, its history and its protections without creating a new session or resetting limits.

`frontend/server/turnstile-widgets.ts` owns the registry. `checkout-guard.ts` retains policy and the global token claim. The existing unique index from migration 68 remains required; no schema migration or reset accompanies this change. Token identity is global across widgets, users, processes and checkout modes. Provider acceptance alone cannot authorize a duplicate token.

Partial/ambiguous registry configuration produces `captcha_configuration_error` instead of disabling the CAPTCHA. The pre-existing intentionally disabled mode and entirely empty local configuration still behave as before when no migration is configured. A migration combined with a disabled mode is invalid. Hard rate limits and failed-card cooldown retain priority over configuration/widget errors.

## Configuration phases

The table below describes the original compatibility rollout. The retirement procedure follows it.

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

## Explicit retirement and reload recovery

`TURNSTILE_WIDGET_MODE` defaults to `compatibility`, preserving the current registry contract. Unknown values fail closed. `secondary_only` requires the B pair (`TURNSTILE_SECONDARY_SITE_KEY`, `TURNSTILE_SECONDARY_SECRET_KEY`) and the compiled public key to equal B. A disabled CAPTCHA policy remains invalid in this mode. A and `TURNSTILE_LEGACY_SITE_KEY` can remain during preparation but are never selected, or can be absent after retirement. Do not copy B into `TURNSTILE_SECRET_KEY` or remove its secondary pair for this mode.

The shared challenge checks `GET /api/turnstile/config` before loading Cloudflare, when a tab returns to the foreground, and when the caller resets the challenge. This dynamic, no-store endpoint returns **only public active/accepted widget identities**; it has no auth, database, Siteverify or payment operation. The browser omits credentials so an old `__vdpl` cookie cannot pin this public read to its previous deployment. Validation requests retain their existing authorization and guard.

When the rendered key is retired, the challenge clears its token and shows a localized **Reload page** button, with a reminder to save unfinished work. It does not reload or retry a submission automatically. On that click only, `POST /api/turnstile/reload` expires the host-only, root-path `__vdpl` cookie before document navigation; authentication cookies remain untouched. The endpoint requires the exact same Origin and rejects cross-site requests. The navigation preserves the page, other query parameters and fragment while removing a possible `dpl` pin. If the POST fails or times out, the page stays in place and offers a retry. A failed/unavailable configuration read cannot start a challenge; it offers a manual retry. The component does not initiate any payment or restore an interrupted submission.

**This recovery is available only in bundles containing this follow-up, on a live alias.** A tab loaded before it cannot receive the new code retroactively and may still require a manual full reload. A pre-follow-up deployment with an HttpOnly pin may also lack the reload endpoint; it needs a fresh browser session or removal of that deployment pin before navigating to the live alias. An immutable deployment hostname continues to read its own environment, even without cookies: navigate to the live alias instead. Neither a five-minute token lifetime nor the skew interval proves those tabs disappeared. Observe actual legacy usage and preserve A until the remaining reload consequence is accepted. A dormant-tab count cannot be established from recent validation traffic alone. The application currently does not set `__vdpl`; if a future routing layer adds a different cookie domain/path, update and requalify the explicit clearing scope.

Future release sequence, requiring separate production authorization:

1. Merge and deploy this code with the current B public key, both secrets, `compatibility` (or absent mode), and diagnostics off. Verify both live aliases and retain this exact compatible Git deployment as rollback. This PR alone changes no production environment values.
2. Qualify reload, retained tabs and replay in isolation. For a real follow-up CAPTCHA session, use only the separately authorized administrator probe; close it afterward. Never use a payment flow as a probe.
3. After accepting the pre-follow-up tab limitation, set `TURNSTILE_WIDGET_MODE=secondary_only` in a separately authorized release while retaining both pairs. The old secret remains available for configuration rollback but is no longer used by that release. Verify B, rejection of A/untagged clients, explicit reload, cooldown and replay. Prevent concurrent builds against intermediate settings.
4. After validation, remove only `TURNSTILE_SECRET_KEY` and `TURNSTILE_LEGACY_SITE_KEY` from future production configuration. Keep the B secondary pair, B public key, `secondary_only`, enabled CAPTCHA policy and diagnostics off. Rebuild through the approved Git workflow and recheck web/API alignment. No secret value must be recovered or copied for this removal.
5. Keep then explicitly retire the compatible fallback. Inventory historical deployments containing A before any authorized deletion: changing project env vars does not purge their immutable environments. Global revocation of A depends on access to its owning Cloudflare account and is separate.

Rollback before A removal: restore `compatibility` with both pairs and deliver the exact recorded compatible Git revision. After A removal, an immutable compatible deployment can still provide immediate recovery if explicitly authorized, but its rollback does not restore project env values for later builds. Confirm secure availability of A before claiming future dual-configuration reconstruction is possible. Never roll back the token-claim index/history or the antifraud controls.

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
  tests/turnstile-retirement-postgres.test.ts \
  tests/turnstile-client.test.ts \
  tests/turnstile-diagnostic-route-postgres.test.ts \
  tests/turnstile-old-tabs-browser.test.ts \
  tests/checkout-captcha-replay-postgres.test.ts \
  tests/hosted-wallet-checkout.test.ts \
  tests/wallet-express-checkout-behavior.test.ts
```

The migration/diagnostic tests use disposable PostgreSQL 17 and synthetic A/B pairs. Siteverify is simulated at the network boundary and deliberately accepts replay; the actual application/database must refuse the duplicate. The endpoint tests stub the external administrator-authentication boundary and exercise the actual route, origin/body gates, guard and SQL claims. Bundling rejects payment dependencies.

The browser test runs the real shared challenge, diagnostic component, public configuration/reload routes and validation route in a local HTTP harness. It keeps A and B tabs open through A→B→A changes and explicit B-only retirement, omits the identifier for the old payload, checks foreground detection, one user-triggered reload into B, Hosted/Express validation, replay/expiry and manual recovery after configuration failure. A stale HttpOnly deployment cookie actually controls the document served; the public config read must omit it, and recovery must clear it while preserving the session cookie. A failed clearing request cannot navigate. It blocks unrelated network requests, asserts zero automatic submissions and zero Stripe session IDs. The Cloudflare browser script and provider response are simulated. This is **not** a real Cloudflare or production end-to-end validation. Use `localhost` for this harness; NextRequest normalizes a loopback IP URL to localhost.

Before merge, required Quality CI must pass on the latest head, including selected integration/browser/financial lanes, following `docs/deployment/github-vercel.md` and `docs/engineering/ci-validation.md`.

## Authorized live validation and rollback, later

1. Recheck current main/production. Deliver D1 through the repository's Git/PR/CI path with A public and both secrets available. Record its exact SHA, deployment ID, immutable URL, aliases and configuration. Do not expose B until D1 is READY, validated and eligible for rollback.
2. With a separately authorized live diagnostic session, open the diagnostic page on the permitted hostname. Load A and check “Simulate an old tab”; retain the tab. In a second tab select B normally. Validate each once and replay each: first use must pass, reuse must fail locally. Check a fresh token after rejection. Check server logs and audit rows without exposing tokens or secrets.
3. Authorize the public-key change to B and a new Git-backed build D2. Verify `maxvideoai.com` and `api.maxvideoai.com` both serve its expected SHA. Retest the retained A tab, a new B tab and replay on the diagnostic. Preserve the protections from #430 and subsequent antifraud fixes.
4. If returning to A, target the **recorded compatible D1**, not an arbitrary older deployment. Its server accepts both generations, including B tabs left open after rollback. Verify both aliases and any pinned request routing; separately authorize any necessary routing intervention. Never re-expose deployments predating #430.
5. A Vercel rollback restores the target build/environment; reconcile the project's public key to A before later builds while retaining both secrets. Verify the post-rollback automatic-domain-assignment state before resuming releases. Do not roll back database claims, delete history or drop the unique index.
6. Disable diagnostics after the authorized session with a controlled build as required by deployment environment snapshots. Do not leave a temporary `localhost` hostname or temporary secret file from any separately authorized local session.

The old A-only D0 (`dpl_8NWY5H6XWVLfaniggTBodxPMcEBV`, SHA `a9f5a66c03017e9812dc69fd804de6d635d7f22e`) is a dated reference, not a compatible rollback target for B tabs. Reassess it against any newer production changes before emergency use.

The earlier D1/D2 instructions describe the compatibility rollout only. Use the explicit retirement sequence above for this follow-up. Its default still accepts A; no automatic migration or retirement of pre-existing browser bundles is claimed.

The previous local live session observed a repeated direct Siteverify probe returning success despite the documented single-use contract; the application replay claim rejected it. Cloudflare analytics also disagreed with observed Siteverify calls. That provider/telemetry discrepancy remains unexplained. Do not remove the local anti-replay guarantee or claim the new production pair has already been tested by this PR.

References: [Cloudflare server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables), [Vercel Skew Protection](https://vercel.com/docs/skew-protection), [Vercel rollback](https://vercel.com/docs/instant-rollback).
