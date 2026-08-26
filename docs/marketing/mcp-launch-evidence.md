# MaxVideoAI MCP launch evidence

Checked: 2026-08-26

## Decision

**Not ready for public promotion, indexation, directory submission, paid public
generation, or production enablement.** The controlled staging endpoint and its
OAuth, account, catalog, budgeting, quote, media, recovery, upload-handoff, and
top-up-handoff paths now have real Claude Desktop and Codex CLI evidence. The
remaining refresh/revocation, fresh private upload, fresh paid render,
failure/refund, legal, directory, and public-rollout gates still block launch.
The checked-in `frontend/config/mcp-publication.json` keeps all eight publication gates false.

The primary account, catalog, budgeting, quote, media, recovery, upload-handoff,
and top-up-handoff checkpoint used staging revision
`33d9e3a498c1fe8947bbb6a4c957d19ca805be25`, deployed as
`dpl_45cqkwyW3U3LAL4pF1D6YUJLoVkH` at
`https://maxvideoai-mcp-staging.vercel.app`. A later, narrower inline-host UI
checkpoint used revision `621881dae621e9aec1d68a2a86f5065c6325cdb8`,
deployment `dpl_3i6XgnZ6KVCZmQPhhKBrHDVrm1TD`, and the same staging origin; it
recovered an existing completed result and recorded native controls, a manual
playback exercise, library state, and the first-party CTA. It did not confirm a
new generation. Production was not changed. LAS and direct Seedance 2.5
video-to-video remained disabled. During the primary checkpoint no new
generation was confirmed, no payment was opened, and the staging wallet stayed
at $1.05.

## Controlled hosted evidence

| Evidence | State | Result |
| --- | --- | --- |
| Claude Desktop 1.37937.1 | Pass | OAuth connection, account status, live catalog/details, 60-second budget comparison, exact Seedance 2.5 quote, private media listing, completed-job recovery, native inline playback, first-party CTA, private upload handoff, and signed top-up handoff with ISO expiry all rendered in the host. |
| Codex CLI 0.149.0-alpha.4.3 | Pass | The installed MaxVideoAI plugin used an ephemeral staging endpoint override and completed account, catalog, model-detail, budget, exact-quote, and top-up-handoff calls. A non-blocking MCP shutdown warning appeared only after completed turns. |
| Account and library continuity | Pass | The tools returned first-party billing, connections, workspace, library, and support destinations; an existing completed video was recovered from the same MaxVideoAI staging account. |
| Spend boundary | Pass | Quote preparation and top-up handoffs did not debit the wallet or call a provider. `confirm_generation` was not called. |
| Reference boundary | Partial | A private temporary upload handoff was created without uploading bytes. A fresh uploaded reference, provider use, and cleanup still need controlled evidence. |
| ChatGPT app directory / Codex graphical library | Not run | No submission, approval, directory install, or graphical ChatGPT app evidence exists yet. |

## Local state matrix

| Evidence | State | Result |
| --- | --- | --- |
| Checked-in all-false build | Pass | All 15 EN/FR/ES MCP, documentation, ChatGPT, Claude, and Codex owners return terminal HTTP 404, `X-Robots-Tag: noindex, nofollow`, rendered noindex metadata, and a rewrite to the genuinely missing locale path `/{locale}/__mcp-publication-gated__`; they remain absent from sitemaps and `llms.txt`. |
| Isolated preview fixture | Pass | `publicMarketing`, transport, OAuth, and discovery were fixture-only; trial, paid generation, reference upload, and indexing remained false. An asserted 1440×1000 viewport and full-page capture show no trial/proof and the targeted unavailable-budget state. |
| Isolated all-gates-green fixture | Pass | The tracked fixture config enabled every gate only inside a temporary copied worktree. Public route, SEO, interaction, private-boundary, conversation-led project proposal, and live price-reference checks passed against a clean production build. |
| Light/dark desktop/mobile visual review | Pass | Light remains the default MaxVideoAI treatment, dark mode has equivalent hierarchy and contrast, and ChatGPT/Claude use equal 24×24 official marks inside equal actions. |
| Prospect-language review | Pass | The hub leads with prompt, references, model choice, budget, and price-before-generation. A contradictory Claude access sentence found during review was replaced in EN/FR/ES with recorded-host status language. |
| Real MCP proof media | Partial | A reviewed Claude Desktop capture proves inline host rendering, native video controls, library state, and the first-party CTA. A manual playback exercise was recorded separately during the controlled test; the still image alone does not demonstrate playback. It is labelled as Claude-specific controlled evidence with a historical capture amount. A job-backed newly generated result bundle remains blocked; no provider gallery asset was relabelled. |
| Real-host purchase/trial/reference funnel | Partial | Real hosts selected models, priced projects, prepared exact quotes, recovered an existing result, and created upload/top-up handoffs. Confirmation, fresh paid generation, trial, uploaded bytes, provider result, and reference cleanup remain unverified. |
| Production GSC/indexation evidence | Baseline captured | A fresh read-only site baseline was captured on 2026-08-26: 6,314 clicks, 491,440 impressions, 1.3% CTR, average position 10.2, and 27,759 generative-feature impressions. MCP-specific post-deployment canonical, query, country, CTR, and cannibalization review remains future evidence. |

## Browser and visual evidence

The Playwright contract is `tests/e2e/mcp-acquisition.spec.ts`. Screenshots are intentionally ignored and stored under
`output/playwright/mcp-acquisition/`:

- `mcp-{desktop,mobile}-{light,dark}-*.png`
- `chatgpt-{desktop,mobile}-{light,dark}-*.png`
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

With JavaScript disabled, all 15 EN/FR/ES intent owners returned 200 in the isolated enabled build with a visible H1,
self-canonical, reciprocal `en`/`fr`/`es`/`x-default` hreflang, JSON-LD, internal links, correct `lang`, localized Spanish
`/integraciones/` slugs, and no password/auth wall. The same owner set fails closed in the checked-in gated build with
HTTP 404, response-header and rendered noindex, and no redirect loop.

After the final clean all-false build, a separate `next start` process was also checked directly with curl and
`Host: maxvideoai.com`: each of the then-current gated owners returned HTTP 404, `X-Robots-Tag: noindex, nofollow`, and a rendered
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

Latest enabled result: 5 passed/2 skipped with 763 static pages. The latest checked-in all-false gated build produced
759 static pages and passed its one applicable browser contract with 6 mode-specific skips. An earlier preview fixture
run passed its applicable contract; preview remains part of the mandatory pre-production command set. Each runner-selected port was free after cleanup, its temporary directory was
removed, and the checked-in publication SHA remained
`9c83b086839609c7dba8df30f5a9b4c4390e6b74fbc0c158e1abf0c739ad1299`.

## Private-route evidence

All checks below used the isolated local enabled fixture. The API host was simulated with `Host: api.maxvideoai.com`;
this did not contact production.

| Route and method | State | Observed boundary |
| --- | --- | --- |
| `GET /mcp` with `Host: api.maxvideoai.com`, without bearer token | Pass | Canonical public API-host path rewrites to the handler and returns 401, private/no-store, noindex/nofollow. |
| `GET /api/mcp` without bearer token | Pass | 401, `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow`. |
| `GET /.well-known/oauth-protected-resource/mcp` without credentials | Pass | The route remains fail-closed, private/no-store, and noindex/nofollow. |
| `GET /oauth/consent` without an authorization id | Pass | 200 invalid-request UI with route-local noindex/nofollow metadata and private/no-store edge headers. |
| `GET /api/wallet` without authentication | Pass | 401 and private/no-store. |
| `POST /api/uploads/image` with an empty multipart body and no authentication | Pass | 401 fail-closed before multipart parsing; no media was stored. Authenticated malformed multipart bodies have a separate 400 regression contract. |
| `robots.txt` | Pass | Blocks `/api/`, `/oauth`, `/account`, `/uploads`, and `/library`. |
| Sitemap variants and `llms.txt` | Pass | Do not expose protocol, consent, wallet, upload, or account URLs. |

## Lighthouse lab evidence

Tooling: LHCI 0.15.1 with Lighthouse 12.6.1, one local mobile run per page, headless Chrome, production fixture on
loopback. These are lab metrics, not field Core Web Vitals and not comparable to a deployed CDN run.

| URL | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Speed index |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/mcp` | 94 | 100 | 96 | 92 | 1.2 s | 3.0 s | 20 ms | 0 | 1.2 s |
| `/integrations/chatgpt` | 95 | 100 | 96 | 92 | 1.2 s | 2.8 s | 0 ms | 0 | 1.2 s |
| `/integrations/claude` | 95 | 100 | 96 | 92 | 1.2 s | 2.9 s | 20 ms | 0 | 1.2 s |
| `/integrations/codex` | 95 | 100 | 96 | 92 | 1.2 s | 2.9 s | 20 ms | 0 | 1.2 s |

The first run identified route-local low-contrast small labels, which were corrected. A later run isolated the global
cookie-settings link; that control now uses the same readable footer-link treatment, and all four post-fix accessibility
audits score 100. The remaining local best-practice
error is generated by absent Vercel analytics assets and a cookie-version API that lacks fixture environment variables.
Lighthouse also reported a missing meta description even though the response HTML and the JavaScript-disabled browser
contract contain the exact description; this is recorded as a local Next streaming/audit discrepancy, not silently
treated as deployed SEO evidence. A clean hosted preview audit remains required.

Fresh remediation command:

```bash
npm run qa:mcp-launch:lighthouse
```

This command reruns the enabled production fixture and browser contract before Lighthouse. Reports are local and ignored
under `frontend/.lighthouseci/` (`lhr-1787749691074`, `lhr-1787749701888`, `lhr-1787749712417`, and
`lhr-1787749722893`, each as JSON and HTML). The fixture injects inert loopback Supabase fallbacks only when the operator environment does not provide values;
no real account or remote Supabase project is used. The runner, browser tests, cleanup, and source-config guard all exited
successfully.

## Promotion blockers and future evidence

| Gate | State | Exact blocker or next evidence |
| --- | --- | --- |
| Codex host lifecycle | Partial pass | Codex CLI 0.149.0-alpha.4.3 completed OAuth-backed discovery, budgeting, quote, and top-up behavior. Refresh, revocation, reconnect, and a graphical ChatGPT/Codex install remain unverified. |
| Claude host lifecycle | Partial pass | Claude Desktop 1.37937.1 completed OAuth-backed discovery, budgeting, quote, media, recovery, inline playback, first-party continuation, upload-handoff, and top-up behavior. Refresh, revocation, reconnect, and fresh successful provider use remain unverified. |
| Real-host decision bundle | Pass without spend | Both hosts produced current model advice, a named project budget, and a fresh exact quote. Claude also recovered an existing completed result. Neither host confirmed a new generation. |
| Paid generation | Blocked | Exact quote and insufficient-balance/top-up recovery are proven in staging, but no newly confirmed provider result or receipt reconciliation was recorded. |
| Trial | Blocked | No live allocation, abuse control, failed-job restoration, or deterministic end-to-end host evidence. |
| Reference workflow | Blocked | Live private media listing and upload handoff are proven; uploaded bytes, reference use, retention/deletion, and cleanup evidence remain missing. |
| Funnel/admin reconciliation | Blocked | Migration files 30–37 are present locally. The staging application exercised quote, media, recovery, and handoff producers, but the full migration inventory and admin/ledger reconciliation still require a sanitized operator review. |
| Owned proof | Blocked | No publishable MCP generation proof with model, settings, price, date, consent, and provenance. |
| Legal/support approval | Blocked | Owner approval for any MCP-specific legal wording and directory terms is still required. |
| Hosted performance and SEO | Not run | Run the public marketing audits only after an explicit enablement decision, then verify GSC indexation and canonical selection after production publication. |

No publication flag should change until a separate reviewed enablement decision closes every claim, host, safety,
support, legal, cost, funnel, and proof gate and the user explicitly approves the change.
