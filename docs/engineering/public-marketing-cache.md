# Public marketing response caching

The public home, pricing and model routes in English, French and Spanish share a
five-minute Vercel CDN response policy, with 60 seconds of stale-while-revalidate.
The marketing shell does not look up the visitor's account. Authenticated app,
account, billing and admin routes are outside this policy.

`frontend/next.config.js` owns the platform route headers. A policy present only
on a middleware rewrite did not establish caching for English dynamic pricing
and model pages: repeated production requests remained MISS while the equivalent
French configured routes became HIT. Middleware unit headers alone are therefore
insufficient verification. `Vercel-CDN-Cache-Control` controls the Vercel cache
separately from the dynamic renderer's browser `Cache-Control` response.

Every configured marketing rule excludes requests carrying Authorization or the
active `mv_logout_intent=1` cookie. Ordinary consent and analytics cookies do not
personalize the public shell. `finalizeResponse` in `routing-response.ts` also
vetoes storage for tracking/noindex responses, redirects and cookie-setting
responses with explicit private/no-store headers and `Vary: *`. This independent
Vary veto survives a renderer replacing browser Cache-Control. Localized pricing
and model paths participate in the same tracking detection and query cleanup.
GET and HEAD are the only methods eligible for Vercel response caching.

Keep route configuration, middleware exclusions and behavioral contracts together:
`tests/marketing-response-cache-contract.test.ts` exercises request matching;
`tests/marketing-layout-cache-contract.test.ts` exercises actual middleware output.
Before release, verify repeated ordinary requests on the Git-backed preview and
production, including tracking URLs, logout cookie clearing and redirects. Record
cache state and final response-header time alongside comparable desktop/mobile
loading measurements; a CDN MISS is not evidence of a cold Node process. Preserve
canonical, hreflang, JSON-LD, locale routing and RSC variant separation.

References: [Vercel response cache criteria](https://vercel.com/docs/caching/cdn-cache)
and [cache header precedence](https://vercel.com/docs/caching/cache-control-headers).
