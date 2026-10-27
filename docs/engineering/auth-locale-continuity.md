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

## Authentication service deadlines

Protected-route middleware bounds the complete Supabase session refresh and
claims verification to eight seconds, including SDK retry delays. The owner is
frontend/lib/middleware/auth-deadline.ts; updateSession composes its signal into
the middleware client's fetch calls, checks cancellation after each await and
ignores late cookie writes. Cancellation uses Edge-compatible event listeners;
completed refresh cookies are retained on the recovery response if claims stall.
Normal route/server clients retain their existing
behavior.

A deadline produces a private, no-store HTTP 503 with Retry-After and a fixed
message in the stored core locale (EN/FR/ES). It does not authorize access,
redirect to sign-in, clear the session or treat an unverified token as a user.
Invalid refresh tokens still follow the existing explicit cookie cleanup path.
This bounds the historical waiting path without claiming to identify the cause
of the upstream authentication delay.

Coverage: tests/middleware-auth-deadline.test.ts exercises a stalled real
updateSession with only the external auth boundary replaced, late cookie
protection, completed refresh preservation, bundled Edge runtime compatibility,
and localized recovery response headers.

## Duplicate password signup

Supabase can return an obfuscated user with empty `identities` and no session
when an already-confirmed account signs up again. Its synthetic id is not a real
consent owner. `submitPasswordSignupConsents` skips that response, and the login
controller displays neutral confirmation/sign-in/recovery guidance without
reporting a new completed signup. Real consent storage errors still block signup
completion; a valid immediate session still requires persistence.

Password signup and confirmation resend mark their return URL with `flow=signup`.
The callback uses that marker to show a confirmation-link error instead of a
Google error when the provider rejects an expired or used link. A real signup
without a session tells the user to click the confirmation button in the mail;
the obfuscated duplicate response keeps neutral guidance. Password sign-in
handles Supabase's `email_not_confirmed` code before the generic invalid-login
path and offers a single user-triggered `auth.resend({ type: 'signup' })` action.
The action preserves locale and the safe return destination, blocks duplicate
clicks, and presents rate limits without promising delivery. Other HTTP 400
responses must not be treated as evidence of a new account.

Confirmation feedback follows the email state, including native autofill updates,
so changing the address removes the previous explanation and resend action.
Password submission waits for client continuation initialization. Auth forms use
POST as their native fallback to keep password fields out of URL queries before
hydration; the client owns their actual submission.

Regression coverage: `tests/auth-locale-continuity.test.ts`,
`tests/login-signup-consents.test.ts`, and the existing login, callback,
marketing-locale and middleware contract suites.

## Password recovery

Reset requests add `flow=recovery` to the existing locale-aware callback. That branch forwards proof to `/auth/reset-password` without exchanging it or falling back to an existing session. The form removes proof from the URL immediately, waits for an explicit Continue action, verifies the session user with Auth, then accepts a confirmed new password. A changed account invalidates the operation. `frontend/lib/password-recovery.ts` owns these pure orchestration helpers; the route owns rendering.

Local email recovery also returns through `/auth/callback`; the local direct
`/login` PKCE exchange remains for Google only. A recovery code must reach the
dedicated form before it is exchanged.

The root hash-session handler skips this route to prevent competing exchanges. GTM/GA4 is excluded. Recovery links preserve the language via middleware cookies; direct `lang` is also accepted by the page. Current hosted `ConfirmationURL` uses PKCE and requires the original browser. Token-hash verification is supported locally but requires a separately published email template before cross-browser recovery is available. Do not claim live delivery or a provider migration based on these local tests.

Coverage: `tests/password-recovery.test.ts` and the auth/locale tests listed above.
