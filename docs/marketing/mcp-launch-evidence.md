# MaxVideoAI MCP launch evidence

Checked: 2026-07-14

## Decision

**Not ready for public promotion, indexation, directory submission, paid generation, or production enablement.** Local
rendering, fail-closed publication, privacy boundaries, and the read-only protocol foundation are substantially verified,
but the real-host, migration, funnel, paid/trial/reference, legal, operational, and owned-proof gates below remain
Blocked or Not run. The checked-in `frontend/config/mcp-publication.json` keeps all eight publication gates false.

No production or staging endpoint was probed, no account was authorized, no provider was called, no credit was spent,
and no user-wide Codex or Claude configuration was changed during Task 11.

## Local state matrix

| Evidence | State | Result |
| --- | --- | --- |
| Checked-in all-false build | Pass | EN/FR/ES MCP and integration owners return terminal 404/noindex responses and remain absent from sitemap and `llms.txt`. |
| Isolated preview fixture | Pass | `publicMarketing`, transport, OAuth, and discovery were fixture-only; trial, paid generation, reference upload, and indexing remained false. The page rendered noindex with no trial, paid budget cards, or proof claim. |
| Isolated all-gates-green fixture | Pass | A temporary ignored config made every gate true without changing the committed flags. Public route, SEO, interaction, and private-boundary checks ran against a clean production build. |
| Light/dark desktop/mobile visual review | Pass | Light remains the default MaxVideoAI treatment, dark mode has equivalent hierarchy and contrast, and Claude/Codex use equal 24×24 marks inside equal actions. |
| Prospect-language review | Pass | The hub leads with prompt, references, model choice, budget, and price-before-generation. A contradictory Claude access sentence found during review was replaced in EN/FR/ES with recorded-host status language. |
| Real MCP proof media | Blocked | There is no publishable MCP proof or demonstration showing an owned end-to-end connected generation. No synthetic or provider gallery asset was relabelled as MCP evidence. |
| Real-host purchase/trial/reference funnel | Not run | Safe local QA cannot establish real client selection, quote, confirmation, trial restoration, top-up, paid generation, provider result, or reference transfer. |
| Production GSC/indexation evidence | Not run | The existing GSC baseline is preserved; post-deployment GSC canonical, query, country, CTR, and cannibalization review is future evidence only. |

## Browser and visual evidence

The Playwright contract is `tests/e2e/mcp-acquisition.spec.ts`. Screenshots are intentionally ignored and stored under
`output/playwright/mcp-acquisition/`:

- `mcp-{desktop,mobile}-{light,dark}-*.png`
- `claude-{desktop,mobile}-{light,dark}-*.png`
- `codex-{desktop,mobile}-{light,dark}-*.png`
- `preview-no-trial-no-paid-light-1440x1000.png`

The enabled fixture captured 1440×1000 and 390×844. The script rejects the cookie banner before evidence capture,
checks official marks and action boxes to within one CSS pixel, verifies keyboard focus and Enter activation, and asserts
that no fake video or “Generated through MCP” proof appears. Objective review found no crop, overflow, focus, logo,
light-default, or dark-parity defect. It did find insufficient contrast on small MCP eyebrow/status labels; those labels now
use the stronger `text-text-secondary` token. The global cookie-settings link remains outside this focused MCP change.

With JavaScript disabled, all 12 EN/FR/ES intent owners returned 200 in the isolated enabled build with a visible H1,
self-canonical, reciprocal `en`/`fr`/`es`/`x-default` hreflang, JSON-LD, internal links, correct `lang`, localized Spanish
`/integraciones/` slugs, and no password/auth wall. The same owner set fails closed in the checked-in gated build.

Commands:

```bash
MCP_E2E_MODE=enabled MCP_E2E_BASE_URL=http://127.0.0.1:62461 \
  npx playwright test tests/e2e/mcp-acquisition.spec.ts --reporter=list
MCP_E2E_MODE=preview MCP_E2E_BASE_URL=http://127.0.0.1:62463 \
  npx playwright test tests/e2e/mcp-acquisition.spec.ts --reporter=list
MCP_E2E_MODE=gated MCP_E2E_BASE_URL=http://127.0.0.1:62460 \
  npx playwright test tests/e2e/mcp-acquisition.spec.ts --reporter=list
```

## Private-route evidence

All checks below used the isolated local enabled fixture. The API host was simulated with `Host: api.maxvideoai.com`;
this did not contact production.

| Route and method | State | Observed boundary |
| --- | --- | --- |
| `GET /api/mcp` without bearer token | Pass | 401, `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow`. |
| `GET /.well-known/oauth-protected-resource/mcp` without Supabase env | Pass | 503 fail-closed, private/no-store, noindex/nofollow. |
| `GET /oauth/consent` without an authorization id | Pass | 200 invalid-request UI with route-local noindex/nofollow metadata and private/no-store edge headers. |
| `GET /api/wallet` without authentication | Pass | 401 and private/no-store. |
| `POST /api/uploads/image` with an empty multipart body | Pass | 400; no media was stored. |
| `robots.txt` | Pass | Blocks `/api/`, `/oauth`, `/account`, `/uploads`, and `/library`. |
| Sitemap variants and `llms.txt` | Pass | Do not expose protocol, consent, wallet, upload, or account URLs. |

## Lighthouse lab evidence

Tooling: LHCI 0.15.1 with Lighthouse 12.6.1, one local mobile run per page, headless Chrome, production fixture on
loopback. These are lab metrics, not field Core Web Vitals and not comparable to a deployed CDN run.

| URL | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Speed index |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/mcp` | 95 | 96 | 96 | 92 | 1.2 s | 3.0 s | 20 ms | 0 | 1.2 s |
| `/integrations/claude` | 95 | 96 | 96 | 92 | 1.2 s | 3.0 s | 10 ms | 0 | 1.2 s |
| `/integrations/codex` | 95 | 96 | 96 | 92 | 1.2 s | 3.0 s | 10 ms | 0 | 1.2 s |

The first run identified route-local low-contrast small labels, which were corrected; the post-fix contrast audit now
flags only the pre-existing global cookie-settings link. The remaining local best-practice
error is generated by absent Vercel analytics assets and a cookie-version API that lacks fixture environment variables.
Lighthouse also reported a missing meta description even though the response HTML and the JavaScript-disabled browser
contract contain the exact description; this is recorded as a local Next streaming/audit discrepancy, not silently
treated as deployed SEO evidence. A clean hosted preview audit remains required.

Command:

```bash
frontend/node_modules/.bin/lhci collect \
  --url=http://127.0.0.1:62461/mcp \
  --url=http://127.0.0.1:62461/integrations/claude \
  --url=http://127.0.0.1:62461/integrations/codex \
  --numberOfRuns=1 --settings.chromeFlags='--headless --no-sandbox'
```

Reports are local and ignored under `frontend/.lighthouseci/`.

## Promotion blockers and future evidence

| Gate | State | Exact blocker or next evidence |
| --- | --- | --- |
| Codex default first-run | Blocked | The default OAuth request still includes `phone`; only the explicit `openid,email,profile` login path has safe evidence. |
| Claude Desktop refresh | Blocked | Revocation/reconnect passes, but token-expiry refresh still needs exact-version hosted evidence. |
| Real-host decision bundle | Not run | No clean-account Codex/Claude quote, confirmation, result, recovery, or host-selection bundle was produced in Task 11. |
| Paid generation | Blocked | No public mutation tool, current quote/confirmation decision evidence, spending-limit recovery, provider result, or receipt reconciliation. |
| Trial | Blocked | No live allocation, abuse control, failed-job restoration, or deterministic end-to-end host evidence. |
| Reference workflow | Blocked | No live upload handoff, model compatibility, retention/deletion, or client transfer evidence. |
| Funnel/admin reconciliation | Blocked | Migrations 30–32 are absent and migration 33 remains unapplied; Task 11 did not query or mutate any database. |
| Owned proof | Blocked | No publishable MCP generation proof with model, settings, price, date, consent, and provenance. |
| Legal/support approval | Blocked | Owner approval for any MCP-specific legal wording and directory terms is still required. |
| Hosted performance and SEO | Not run | Run the same audits on a controlled preview, then verify post-deployment GSC indexation and canonical selection. |

No publication flag should change until a separate reviewed enablement decision closes every claim, host, safety,
support, legal, cost, funnel, and proof gate and the user explicitly approves the change.
