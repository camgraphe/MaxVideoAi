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
| Checked-in all-false build | Pass | All 12 EN/FR/ES MCP owners return terminal HTTP 404, `X-Robots-Tag: noindex, nofollow`, rendered noindex metadata, and a rewrite to the genuinely missing locale path `/{locale}/__mcp-publication-gated__`; they remain absent from sitemaps and `llms.txt`. |
| Isolated preview fixture | Pass | `publicMarketing`, transport, OAuth, and discovery were fixture-only; trial, paid generation, reference upload, and indexing remained false. An asserted 1440×1000 viewport and full-page capture show no trial/proof and the targeted unavailable-budget state. |
| Isolated all-gates-green fixture | Pass | The tracked fixture config enabled every gate only inside a temporary copied worktree. Public route, SEO, interaction, private-boundary, trial, and three-option budget checks passed against a clean production build. |
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
- `preview-budget-unavailable-light-1440x1000.png`
- `enabled-budget-trial-paid-light-1440x1000.png`

The browser contract explicitly sets and reads back a 1440×1000 preview viewport. The enabled fixture captured 1440×1000
and 390×844. The script rejects the cookie banner before every evidence capture,
checks official marks and action boxes to within one CSS pixel, verifies keyboard focus and Enter activation, and asserts
that no fake video or “Generated through MCP” proof appears. Objective review found no crop, overflow, focus, logo,
light-default, or dark-parity defect. It did find insufficient contrast on small MCP eyebrow/status labels; those labels now
use the stronger `text-text-secondary` token. The global cookie-settings link remains outside this focused MCP change.

The four final Codex PNGs were independently decoded after recapture: macOS `sips` re-encoded every file, and
FFmpeg decoded each complete image while `ffprobe` reported 1440×1000 for desktop and 390×844 for mobile. Direct visual
inspection of all four light/dark images found no corruption, partial decode, artificial crop, or missing region. The earlier
apparent corruption was therefore a viewer artifact, not a defect in the saved PNGs.

With JavaScript disabled, all 12 EN/FR/ES intent owners returned 200 in the isolated enabled build with a visible H1,
self-canonical, reciprocal `en`/`fr`/`es`/`x-default` hreflang, JSON-LD, internal links, correct `lang`, localized Spanish
`/integraciones/` slugs, and no password/auth wall. The same owner set fails closed in the checked-in gated build with
HTTP 404, response-header and rendered noindex, and no redirect loop.

After the final clean all-false build, a separate `next start` process was also checked directly with curl and
`Host: maxvideoai.com`: each of the 12 owners returned HTTP 404, `X-Robots-Tag: noindex, nofollow`, and a rendered
robots noindex meta tag. The process was stopped and its loopback port was confirmed free.

The reproducible runner reads `tests/fixtures/mcp-launch-publication-states.json`, copies only current workspace files to a
temporary directory, links the existing dependency installation, selects a free loopback port, runs a clean production
build/start/browser test, kills the process group, deletes the fixture, and verifies the source publication-config SHA and
Git diff before and after. It has no dependency on ignored publication JSON. Commands:

```bash
npm run qa:mcp-launch:gated
npm run qa:mcp-launch:preview
npm run qa:mcp-launch:enabled
```

Final results: gated 1 passed/6 skipped with 729 static pages; preview 1 passed/6 skipped with 733 static pages; enabled
5 passed/2 skipped with 733 static pages. Each runner-selected port was free after cleanup, its temporary directory was
removed, and the checked-in publication SHA remained
`9c83b086839609c7dba8df30f5a9b4c4390e6b74fbc0c158e1abf0c739ad1299`.

## Private-route evidence

All checks below used the isolated local enabled fixture. The API host was simulated with `Host: api.maxvideoai.com`;
this did not contact production.

| Route and method | State | Observed boundary |
| --- | --- | --- |
| `GET /mcp` with `Host: api.maxvideoai.com`, without bearer token | Pass | Canonical public API-host path rewrites to the handler and returns 401, private/no-store, noindex/nofollow. |
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
| `/mcp` | 95 | 96 | 96 | 92 | 1.2 s | 3.0 s | 10 ms | 0 | 1.2 s |
| `/integrations/claude` | 95 | 96 | 96 | 92 | 1.2 s | 3.0 s | 10 ms | 0 | 1.2 s |
| `/integrations/codex` | 95 | 96 | 96 | 92 | 1.2 s | 3.0 s | 10 ms | 0 | 1.2 s |

The first run identified route-local low-contrast small labels, which were corrected; the post-fix contrast audit now
flags only the pre-existing global cookie-settings link. The remaining local best-practice
error is generated by absent Vercel analytics assets and a cookie-version API that lacks fixture environment variables.
Lighthouse also reported a missing meta description even though the response HTML and the JavaScript-disabled browser
contract contain the exact description; this is recorded as a local Next streaming/audit discrepancy, not silently
treated as deployed SEO evidence. A clean hosted preview audit remains required.

Fresh remediation command:

```bash
npm run qa:mcp-launch:lighthouse
```

This command reruns the enabled production fixture and browser contract before Lighthouse. Reports are local and ignored
under `frontend/.lighthouseci/` (`lhr-1784021692267`, `lhr-1784021703046`, and `lhr-1784021713480`, each as JSON and
HTML). The fixture deliberately lacks Supabase environment variables, so protected-route requests emit expected local
errors while remaining fail-closed; the runner, browser tests, Lighthouse collection, cleanup, and source-config guard all
exited successfully.

## Promotion blockers and future evidence

| Gate | State | Exact blocker or next evidence |
| --- | --- | --- |
| Codex host lifecycle | Not run | OAuth, revocation, refresh, rendering, and tool selection remain unverified; Task 10 must capture fresh host evidence. |
| Claude host lifecycle | Not run | OAuth, revocation, refresh, rendering, and tool selection remain unverified; Task 10 must capture fresh host evidence. |
| Real-host decision bundle | Not run | No clean-account Codex/Claude quote, confirmation, result, recovery, or host-selection bundle was produced in Task 11. |
| Paid generation | Blocked | No public mutation tool, current quote/confirmation decision evidence, spending-limit recovery, provider result, or receipt reconciliation. |
| Trial | Blocked | No live allocation, abuse control, failed-job restoration, or deterministic end-to-end host evidence. |
| Reference workflow | Blocked | No live upload handoff, model compatibility, retention/deletion, or client transfer evidence. |
| Funnel/admin reconciliation | Blocked | Migration files 30–37 are present locally; staging application remains unverified pending Task 10. Task 11 did not query or mutate any database. |
| Owned proof | Blocked | No publishable MCP generation proof with model, settings, price, date, consent, and provenance. |
| Legal/support approval | Blocked | Owner approval for any MCP-specific legal wording and directory terms is still required. |
| Hosted performance and SEO | Not run | Run the same audits on a controlled preview, then verify post-deployment GSC indexation and canonical selection. |

No publication flag should change until a separate reviewed enablement decision closes every claim, host, safety,
support, legal, cost, funnel, and proof gate and the user explicitly approves the change.
