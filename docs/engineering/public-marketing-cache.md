# Public marketing response caching

The public home, pricing and model routes in English, French and Spanish share a
five-minute Vercel CDN response policy, with 60 seconds of stale-while-revalidate.
The marketing shell does not look up the visitor's account. Authenticated app,
account, billing and admin routes are outside this policy. Do not add personalized
server content to these cacheable routes without changing this contract.

`frontend/next.config.js` owns the platform route headers. A policy present only
on a middleware rewrite did not establish caching for English dynamic pricing
and model pages: repeated production requests remained MISS while the equivalent
French configured routes became HIT. Middleware unit headers alone are therefore
insufficient verification. `Vercel-CDN-Cache-Control` controls the Vercel cache
separately from the dynamic renderer's browser `Cache-Control` response.

## Public HTML and per-request behavior

Tracking URLs use the same public HTML policy, with a distinct cache entry for
their query string. Middleware preserves `noindex, follow` and the clean canonical
URL; ordinary URL responses must not inherit that tracking robots tag. Localized
pricing and model paths participate in tracking detection and query cleanup.
Consent and analytics cookies do not personalize the server shell. GET and HEAD
are the only methods eligible for Vercel response caching.

Every configured rule omits cache headers when Authorization or the active
`mv_logout_intent=1` cookie is present. These request matches do not guarantee
bypassing an already warmed public response. Authorization is also excluded by
Vercel's cache criteria and middleware eligibility. `finalizeResponse` emits
private/no-store headers and `Vary: *` for middleware redirects and cookie-setting
responses. On a rendered route, Next can replace Vary and Vercel can still reuse
the public HTML. In particular, logout may receive a HIT while middleware clears
its cookie afresh; that Set-Cookie must never appear on the next ordinary response.
Strict bypass of every logout response is not an invariant of this design.

This policy was checked against the Git-backed deployment: sampled English pricing and model
ordinary/logout responses had identical HTML hashes, the logout cookie was empty with Path=/ and
Max-Age=0, subsequent anonymous responses had no Set-Cookie, and tracked versus
ordinary URLs retained separate bodies and robots tags. HTML and RSC responses
also retained their separate content types/cache variants. A proposed middleware
no-store veto for rendered tracking responses was disproved by MISS-to-HIT probes;
this document deliberately describes the observed public per-URL cache policy.

## Verification

Keep route configuration, middleware behavior and contracts together:
`tests/marketing-response-cache-contract.test.ts` exercises configured request
matching; `tests/marketing-layout-cache-contract.test.ts` exercises actual
middleware output. Neither establishes final CDN behavior by itself. Before
release, verify repeated ordinary requests on the Git-backed preview and
production, including tracking URLs, logout cookie clearing, ordinary responses
after logout/tracking, redirects and RSC variants. Record cache state and final
response-header time alongside comparable desktop/mobile loading measurements;
a CDN MISS is not evidence of a cold Node process. Preserve canonical, hreflang,
JSON-LD and locale routing. Recheck public/account isolation if shell data changes.

References: [Vercel response cache criteria](https://vercel.com/docs/caching/cdn-cache)
and [cache header precedence](https://vercel.com/docs/caching/cache-control-headers).
