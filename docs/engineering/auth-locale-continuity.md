# Authentication and locale continuity

Public marketing pages derive language from their URL (`/` is English, `/fr`
French, `/es` Spanish). Their cached output must remain independent of cookies,
browser language and IP location. Core routes such as `/login`, `/app` and
`/billing` use the `mvid_locale` cookie, then `NEXT_LOCALE`, then English.

## Crossing into the application

- Marketing login links call `buildLoginHref` with the displayed `locale`.
  The resulting `lang` parameter is consumed by `resolveLangParamRedirect`.
  It persists both locale cookies and redirects to the unprefixed core URL,
  retaining the auth mode and exact `next` destination.
- Explicit language redirects are private, uncached and use `no-referrer` so
  the previous page cannot override that choice on the clean URL request.
- For links without `lang` (including Generate), `createCoreLocaleResponse`
  carries language from a same-origin marketing referrer into both request and
  response cookies. This covers document and actual RSC navigations, without an
  extra redirect. Requests marked as prefetch and external/core referrers do not
  change language. Next.js strips Flight headers before middleware, so an
  `rsc` header is not required to recognize fetch-based navigation; keep
  marketing auth links configured with `prefetch={false}`.
- Legacy `/fr/login` and `/es/app` paths preserve their locale before removing
  the prefix. Authentication and protected-route checks still run normally.
- Password signup, password reset and Google OAuth all include the displayed
  language in `buildAuthCallbackRedirect`. The callback's `lang` is consumed by
  middleware before exchanging the code; session cookies and the exact return
  destination remain under the existing auth callback's ownership. This also
  restores language when an email link opens in a different browser.
- Signup consent records use the displayed language, not `navigator.language`.

Direct visits without an explicit language or marketing referrer retain the
stored preference. Neither IP country nor `Accept-Language` overrides it.

## Duplicate password signup

Supabase can return an obfuscated user with empty `identities` and no session
when an already-confirmed account signs up again. Its synthetic id is not a real
consent owner. `submitPasswordSignupConsents` skips that response, and the login
controller displays neutral confirmation/sign-in/recovery guidance without
reporting a new completed signup. Real consent storage errors still block signup
completion; a valid immediate session still requires persistence.

Regression coverage: `tests/auth-locale-continuity.test.ts`,
`tests/login-signup-consents.test.ts`, and the existing login, callback,
marketing-locale and middleware contract suites.

## Password recovery

Reset requests add `flow=recovery` to the existing locale-aware callback. That branch forwards proof to `/auth/reset-password` without exchanging it or falling back to an existing session. The form removes proof from the URL immediately, waits for an explicit Continue action, verifies the session user with Auth, then accepts a confirmed new password. A changed account invalidates the operation. `frontend/lib/password-recovery.ts` owns these pure orchestration helpers; the route owns rendering.

The root hash-session handler skips this route to prevent competing exchanges. GTM/GA4 is excluded. Recovery links preserve the language via middleware cookies; direct `lang` is also accepted by the page. Current hosted `ConfirmationURL` uses PKCE and requires the original browser. Token-hash verification is supported locally but requires a separately published email template before cross-browser recovery is available. Do not claim live delivery or a provider migration based on these local tests.

Coverage: `tests/password-recovery.test.ts` and the auth/locale tests listed above.
