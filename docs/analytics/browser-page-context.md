# Browser analytics page context

Implemented 2026-10-20. Production status is established by the merged commit and
deployment evidence, not by this document.

`page-context.ts` owns the browser URL, title and referrer supplied to GA4.
`journey-browser.ts` adds this trusted context **after** the restrictive journey
projection. Queued events retain their observed safe page; `ordered-events.ts`
revalidates that context immediately before `gtag`, before the 25-parameter cap.
Callers cannot opt free-form page titles or private URLs into the payload.

Public allowlisted paths preserve their locale and slug. Workspace, billing,
authentication and shared-video identifiers collapse to bounded surfaces.
Queries and fragments are removed; referrers retain only their origin.
Unknown tool/route identities collapse instead of becoming new analytics values.
Approved UTM combinations from the existing journey contract are preserved as
native GA campaign fields. The bootstrap sets the same safe defaults for automatic
engagement and refreshes them on route changes with `send_page_view: false`.
The app's route tracker remains the authored page-view mechanism.

Required GA4 administration: disable enhanced history-based page views.
Automatic outbound clicks, site search, form interaction and file downloads
must also remain disabled: their separate parameters can carry free text or
private URLs, bypassing this event transport. Existing authored business events
remain enabled. No historical records are deleted by this change.

`VercelAnalytics.tsx` supplies a `beforeSend` callback in both app runtimes.
It applies the same URL projection, retains approved UTM fields, and drops
excluded routes and known administrators. Its existing visitor population and
cookie-free collection remain distinct from consented GA4; do not compare its
referrer count with GA4 attributed sessions as if both meant new clicks.
This callback does not claim to modify vendor-generated fields outside its API.

Checkout GA reads use the existing 400 ms overall parallel lookup budget.
A missing tag is checked again within that budget; a blocked tag never blocks
payment beyond it. Consent and known exclusion are rechecked before requesting
IDs and after responses. The wallet API still independently verifies consent.
Existing first-party checkout interaction records add only `ga4LookupStatus`:
`complete`, `client_missing`, `session_missing`, `identifiers_missing`,
`tag_unavailable`, `measurement_unconfigured`, `consent_or_role_excluded`
(`unobserved` is a defensive caller fallback).
No GA identifier is added to this diagnostic. Express session readiness and
hosted redirection carry it; failed pre-session requests are outside its scope.

These categories support aggregate diagnosis; they are not proof of GA receipt
or session attribution. The server sender remains best effort with no durable
outbox. See [wallet scope and limitations](ga4-topups.md).

Regression coverage: `analytics-page-privacy`, `analytics-bootstrap-exclusion`,
`analytics-browser-transport`, `ga4-session-attribution`,
`vercel-analytics-privacy`, and the existing consent/role/Clarity tests.
Use synthetic private values. Do not make live purchases or paid generations
to verify the transport.
