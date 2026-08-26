# MaxVideoAI Plugin Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a production-ready MaxVideoAI conversational video product for ChatGPT, Claude, Codex, and compatible MCP clients, with reliable account continuity, automatic model parity, acquisition pages, distribution assets, and evidence-backed publication.

**Architecture:** Keep one MaxVideoAI backend and one live catalog. ChatGPT, Claude, Codex, and other clients receive a thin plugin/skill plus the same OAuth-protected MCP server. The server exposes current facts and bounded actions; the host owns the creative conversation. Marketing pages describe the outcome first and MCP second. Production opens through explicit capability and publication gates only after hosted evidence passes.

**Tech Stack:** Next.js App Router, TypeScript, MCP TypeScript SDK, Zod, Supabase OAuth 2.1, Neon/Postgres, Vercel, Stripe wallet funding, S3-compatible media storage, Node test runner, Playwright, JSON-LD, sitemap/robots/llms.txt.

**Spec:** `docs/superpowers/specs/2026-08-26-maxvideoai-plugin-acquisition-and-continuity-design.md`

## Global Constraints

- Work only on `codex/mcp-foundation-clean` or a descendant dedicated branch; do not merge into `main` as part of these plans.
- Read root `AGENTS.md`, `docs/engineering/llm-working-guide.md`, and the nearest nested `AGENTS.md` before changing code.
- Preserve `frontend/config/model-registry.json` as the only authored model identity/publication source.
- Never duplicate model names, capabilities, availability, prices, or provider routing inside the plugin skill or marketing copy.
- Preserve the exact-price then explicit-confirmation boundary. No assistant may fund a wallet, confirm on behalf of a user, or retry a paid generation automatically.
- Keep the light theme as the default and verify complete dark-mode parity.
- Keep the public promise commercial and positive. Internal task names, fixture language, and broad “unverified” disclaimers do not belong on prospect pages.
- Do not claim a directory listing, host compatibility, free credit, reference type, model mode, or production endpoint before current evidence supports it.
- Do not create external repositories, submit directories, change DNS, enable production flags, or deploy production without a separately authorized release action.
- Do not spend generation credits during automated validation. Paid canaries require an explicit bounded test budget and user approval.

## Baseline at Plan Approval

| Area | What already works on the dedicated branch | What still blocks a public production launch |
| --- | --- | --- |
| Remote product | A hosted staging MCP, OAuth connection, thirteen tools, live catalog reads, model advice, project estimates, exact quotes, explicit confirmation, job recovery, inline result presentation, private media listing, upload and top-up handoffs. | Production DNS/OAuth/flags, exact output schemas, final host evidence, operational/legal review, and controlled rollout. |
| Account continuity | MCP jobs use the same owned job/media system as the MaxVideoAI site; `/app`, `/app/image`, and `/app/library` are the canonical customer surfaces. | Every relevant tool must return typed account, billing, workspace, and library destinations and teach the mandatory top-up → balance refresh → fresh quote flow. |
| Model coverage | Forty-two app-published models are discovered from the shared registry. Common text/image/reference/video modes already use the canonical agent path; Seedance 2.5 ModelArk modes are not blocked by LAS. | Close the seven specialized model-mode gaps, support every canonical mode in project budgets, finish LAS-only Seedance 2.5 V2V, and make drift fail CI. |
| Acquisition | Localized MCP, Claude, Codex, and technical-doc routes plus reusable marketing components already exist. | Add ChatGPT intent ownership, replace preview/internal copy, remove generic budget boxes, add homepage/internal links, publish real proof, and independently enable route visibility/indexing. |
| Distribution | A shared MaxVideoAI skill plus Codex, Claude, and remote MCP manifests exist. | Finalize manifests, create the ChatGPT review artifact and safe public bundle, prove each host, prepare GitHub, and recheck directory rules before any submission. |

Checked-in production publication flags are all false at this baseline. That is a safe release posture, not evidence that the product work is absent: staging can continue while production transport, paid actions, marketing visibility, and indexing remain independently gated.

---

## Workstream Map

| Order | Plan | Outcome | Depends on |
| --- | --- | --- | --- |
| 1 | `2026-08-26-maxvideoai-account-and-media-continuity.md` | Assistants can explain the account, credits, top-up, fresh quote, generation recovery, references, and MaxVideoAI library without guessing. | Existing staging foundation |
| 2 | `2026-08-26-maxvideoai-mcp-catalog-maintenance.md` | Every supported public model/mode stays synchronized with the MCP and model changes fail CI when agent coverage drifts. | Workstream 1 types may be in flight, but no hard dependency |
| 3 | `2026-08-26-maxvideoai-plugin-acquisition-seo-geo.md` | A sellable ChatGPT-first acquisition hub, client pages, homepage insertion, proof, SEO/GEO, and internal linking. | Product contract from workstreams 1–2 |
| 4 | `2026-08-26-maxvideoai-plugin-distribution-production.md` | Valid plugin packages, ChatGPT submission artifact, GitHub distribution package, production runbook, hosted compatibility evidence, and controlled release gates. | Workstreams 1–3 |

## Release Invariants

- [ ] The same connected account owns web and MCP jobs, references, wallet state, and library history.
- [ ] Every accepted generation returns a recoverable job identifier and a canonical MaxVideoAI destination.
- [ ] Every completed generation states that the result is saved to `/app/library` and provides a structured destination.
- [ ] Insufficient balance produces a secure browser handoff, never a payment form inside the assistant.
- [ ] Funding invalidates the old quote; a new `prepare_generation` is mandatory before another confirmation request.
- [ ] `pnpm mcp:catalog:check` fails when a public supported model/mode is silently absent from MCP details or generation schemas.
- [ ] ChatGPT and Claude are equal primary acquisition surfaces; Codex remains a supported and indexable technical surface.
- [ ] `/mcp`, `/integrations/chatgpt`, `/integrations/claude`, `/integrations/codex`, and `/docs/mcp` have distinct search intent and reciprocal localized URLs.
- [ ] Public pages render useful answer passages server-side, include current evidence dates, and contain no internal release vocabulary.
- [ ] All thirteen tools declare accurate side-effect annotations and explicit output schemas before ChatGPT submission packaging.
- [ ] Production capability flags, marketing visibility, and indexing are separate deliberate decisions with a tested rollback path.

## Completion Gate

- [ ] Execute all four linked plans in order.
- [ ] Run the combined verification suite listed in each plan.
- [ ] Review the final diff for secrets, production-only mutations, unsupported claims, duplicated catalog facts, and accidental changes outside the MCP branch.
- [ ] Record the final hosted evidence revision and deployment identifiers.
- [ ] Stop before external submission or production enablement and request the specific owner approval for those irreversible/public actions.
