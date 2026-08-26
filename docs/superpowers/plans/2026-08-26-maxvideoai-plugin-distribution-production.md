# MaxVideoAI Plugin Distribution and Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Package, validate, deploy, and distribute MaxVideoAI as a reliable plugin/connector for ChatGPT, Claude, Codex, and compatible MCP clients, while keeping the private application backend private and production release reversible.

**Architecture:** Ship a thin public package containing manifests, skill instructions, brand assets, installation documentation, and a remote MCP pointer. The production MCP remains a first-party OAuth-protected service on api.maxvideoai.com. Each tool declares exact input/output contracts and side effects. Website installation works without an external directory; GitHub and directories add discovery after production compatibility is proven.

**Tech Stack:** Codex/Claude plugin manifests, MCP TypeScript SDK, Zod, OpenAI ChatGPT app submission JSON, GitHub releases, Vercel, Supabase OAuth 2.1, Neon, Stripe, S3, observability and launch flags.

**Spec:** docs/superpowers/specs/2026-08-26-maxvideoai-plugin-acquisition-and-continuity-design.md

## Global Constraints

- Initial release has no large embedded UI. The conversation plus structured tools and open_url actions are the product.
- Do not publish backend source, environment files, database schemas, provider keys, OAuth secrets, Stripe secrets, staging credentials, private media, or internal evidence IDs.
- Do not create a public GitHub repository, DNS record, directory submission, marketplace entry, or production deployment without a distinct owner-approved action.
- Website/manual installation is a valid primary distribution path even if no directory accepts or lists the product.
- Treat directory rules, product names, and submission schemas as unstable; recheck official sources immediately before an authorized submission.
- Keep capability flags and marketing/indexing flags off until their corresponding evidence gates pass.

---

## Task 1: Add exact output schemas and correct tool annotations

**Files:**
- Create: frontend/src/server/mcp/tool-output-schemas.ts
- Modify: frontend/src/server/mcp/tools/get-account-status.ts
- Modify: frontend/src/server/mcp/tools/list-models.ts
- Modify: frontend/src/server/mcp/tools/get-model-details.ts
- Modify: frontend/src/server/mcp/tools/recommend-models.ts
- Modify: frontend/src/server/mcp/tools/calculate-project-budget.ts
- Modify: frontend/src/server/mcp/tools/list-media.ts
- Modify: frontend/src/server/mcp/tools/create-reference-upload-link.ts
- Modify: frontend/src/server/mcp/tools/prepare-generation.ts
- Modify: frontend/src/server/mcp/tools/confirm-generation.ts
- Modify: frontend/src/server/mcp/tools/get-generation-status.ts
- Modify: frontend/src/server/mcp/tools/list-recent-generations.ts
- Modify: frontend/src/server/mcp/tools/create-topup-link.ts
- Modify: frontend/src/server/mcp/tool-result.ts
- Modify: tests/mcp-tools-contract.test.ts
- Modify: tests/mcp-agent-contract.test.ts
- Modify: tests/mcp-generation-recovery-tools.test.ts
- Create: tests/mcp-output-schemas.test.ts

- [ ] Write a failing inventory test requiring every registered tool to declare inputSchema, outputSchema, readOnlyHint, destructiveHint, and openWorldHint.
- [ ] Define strict Zod output schemas for all twelve success DTOs. Reuse smaller money, destination, model, reference, quote, status, pagination, and error schemas; do not use z.any(), passthrough, or an invented generic object.
- [ ] Ensure structuredContent validates before returning success. If an internal DTO violates its declared schema, log a correlation ID and return the existing sanitized INTERNAL_ERROR rather than leaking the invalid object.
- [ ] Audit annotations against implementations:

| Tool | readOnly | destructive | open world | Reason |
| --- | --- | --- | --- | --- |
| get_account_status | true | false | false | Reads owned account/wallet state |
| list_models | true | false | false | Reads current public catalog |
| get_model_details | true | false | false | Reads one public model contract |
| recommend_models | true | false | false | Computes factual matches |
| calculate_project_budget | true | false | false | Computes estimates without reserving |
| list_media | true | false | false | Reads owned private media metadata |
| get_generation_status | true | false | false | Reads one owned job |
| list_recent_generations | true | false | false | Reads owned recent jobs |
| prepare_generation | false | false | false | Persists a short-lived quote |
| create_reference_upload_link | false | false | false | Creates a private MaxVideoAI upload session |
| create_topup_link | false | false | false | Invalidates one quote and creates a private billing handoff |
| confirm_generation | false | false | true | Creates a paid provider generation after explicit confirmation |

- [ ] Re-evaluate openWorldHint if the current OpenAI review definition changes. Document any divergence instead of matching this table blindly.
- [ ] Verify no input schema solicits card data, credentials, MFA codes, identity documents, or provider secrets.
- [ ] Run focused tests and commit.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-output-schemas.test.ts tests/mcp-tools-contract.test.ts tests/mcp-agent-contract.test.ts tests/mcp-generation-recovery-tools.test.ts
    git add frontend/src/server/mcp tests/mcp-output-schemas.test.ts tests/mcp-tools-contract.test.ts tests/mcp-agent-contract.test.ts tests/mcp-generation-recovery-tools.test.ts
    git commit -m "feat(mcp): declare exact tool output contracts"

## Task 2: Finalize the universal plugin package

**Files:**
- Modify: plugins/maxvideoai/.codex-plugin/plugin.json
- Modify: plugins/maxvideoai/.claude-plugin/plugin.json
- Modify: plugins/maxvideoai/.mcp.json
- Modify: plugins/maxvideoai/README.md
- Modify: plugins/maxvideoai/skills/maxvideoai/SKILL.md
- Modify: plugins/maxvideoai/skills/maxvideoai/references/budget-planning.md
- Modify: plugins/maxvideoai/skills/maxvideoai/references/generation-safety.md
- Modify: plugins/maxvideoai/assets/logo-mark.svg if the current mark fails packaging contrast checks
- Modify: tests/mcp-plugin-contract.test.ts

- [ ] Lead manifest/README metadata with the customer outcome, not “MCP foundation”.
- [ ] Use a concise description that covers planning, live model advice, project budgets, exact quotes, references, confirmation, generation, recovery, and the shared MaxVideoAI library.
- [ ] Keep one remote endpoint, https://api.maxvideoai.com/mcp, and one shared skill. Do not package a model list or static prices.
- [ ] Use the existing valid MaxVideoAI logo in light/dark contexts. Do not embed third-party marks inside the installable product logo.
- [ ] Keep the OpenAI/Codex and Claude adapters thin and reference the same skill.
- [ ] Decide the public-package license with the owner/legal reviewer. Do not silently change BUSL-1.1.
- [ ] Run repository tests plus the official local validators.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-plugin-contract.test.ts
    python3 /Users/adrienmillot/.codex/skills/.system/skill-creator/scripts/quick_validate.py plugins/maxvideoai/skills/maxvideoai
    python3 /Users/adrienmillot/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/maxvideoai

- [ ] Use the plugin cachebuster helper for local updates and reinstall. Do not edit the personal marketplace file by hand.
- [ ] Start a new Codex task after reinstall and verify the twelve tools and new output schemas load.
- [ ] Commit.

    git add plugins/maxvideoai tests/mcp-plugin-contract.test.ts
    git commit -m "feat(plugin): finalize universal package metadata"

## Task 3: Generate the ChatGPT app review artifact

**Files:**
- Create: chatgpt-app-submission.json
- Create: tests/chatgpt-app-submission.test.ts
- Modify: docs/marketing/mcp-directory-submissions.md

- [ ] Run the ChatGPT app submission inspection against the final twelve-tool server, following every service far enough to verify reads, writes, provider submission, quote invalidation, and browser handoffs.
- [ ] Block generation if any annotation is missing or mismatched; fix source in Task 1 first.
- [ ] Generate exactly one root chatgpt-app-submission.json with:
  - schema_version 1 and current official schema URL;
  - display name MaxVideoAI;
  - subtitle no longer than 30 characters;
  - category DESIGN unless the current submission taxonomy dictates another reviewed choice;
  - all twelve tools with exact annotations and one-sentence justifications;
  - exactly five positive test cases;
  - exactly three unrelated negative test cases.
- [ ] Cover these positive review journeys across the five cases: model/budget advice, private reference selection/upload, exact quote with explicit confirmation, top-up plus mandatory fresh quote, and generation recovery/library.
- [ ] Cover unrelated negative prompts such as video editing advice without a MaxVideoAI action, calendar scheduling, and requests to collect payment credentials.
- [ ] Do not include secrets, paths, prompt contents from real users, request IDs, or internal evidence identifiers.
- [ ] Add a contract test for counts, tool inventory, annotations, no sensitive fields, and deterministic JSON.
- [ ] Record output-schema completion and any remaining review findings in the submission runbook.
- [ ] Run and commit.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/chatgpt-app-submission.test.ts tests/mcp-output-schemas.test.ts
    git add chatgpt-app-submission.json tests/chatgpt-app-submission.test.ts docs/marketing/mcp-directory-submissions.md
    git commit -m "docs(plugin): prepare chatgpt app submission"

## Task 4: Build a safe public release bundle

**Files:**
- Create: scripts/build-maxvideoai-plugin-release.mjs
- Create: tests/mcp-public-release-bundle.test.ts
- Modify: package.json
- Modify: docs/marketing/mcp-directory-submissions.md
- Source only: plugins/maxvideoai/

- [ ] Write a failing release-bundle test that rejects symlinks, secrets, environment files, source maps, backend paths, internal docs, staging origins, private evidence IDs, and absolute local paths.
- [ ] Add a deterministic command:

    "plugin:release:build": "node scripts/build-maxvideoai-plugin-release.mjs"

- [ ] Export only approved files into a disposable dist/maxvideoai-plugin directory:
  - Codex/Claude manifests and remote MCP config;
  - shared skill and references;
  - MaxVideoAI logo;
  - public README, license, changelog, security policy, and support links;
  - optional current server/registry metadata required by a target directory.
- [ ] Generate a checksum manifest and fail when source metadata versions disagree.
- [ ] Do not commit the generated dist directory unless the repository’s release policy explicitly requires it. Commit the builder and tests.
- [ ] Run, inspect, and commit.

    pnpm plugin:release:build
    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-public-release-bundle.test.ts
    git add scripts/build-maxvideoai-plugin-release.mjs tests/mcp-public-release-bundle.test.ts package.json docs/marketing/mcp-directory-submissions.md
    git commit -m "build(plugin): create safe public release bundle"

## Task 5: Prepare the public GitHub distribution repository

**Files:**
- Create planning template: docs/operations/mcp-public-repository.md
- Modify: plugins/maxvideoai/README.md
- Modify: docs/marketing/mcp-directory-submissions.md
- Modify after the canonical repository URL exists: frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts

- [ ] Define the public repository content, branch protection, release tags, changelog, issues/support boundaries, responsible disclosure, license, and canonical website link.
- [ ] Prepare GitHub topics only when accurate: mcp, model-context-protocol, chatgpt-plugin, claude-connector, codex-plugin, ai-video, video-generation.
- [ ] Keep the README outcome-first and include separate ChatGPT, Claude, Codex, and generic MCP install sections, credits/library behavior, permission overview, and a verified demo.
- [ ] Add a repository backlink to the website only after the canonical public URL exists.
- [ ] Stop before creating/pushing the external repository. Ask the user to authorize the exact organization, repository name, visibility, and first public push.
- [ ] After approval, publish only the release bundle or dedicated public history, never the private monorepo history.
- [ ] Tag the same version recorded in manifests and evidence.

## Task 6: Close production OAuth, endpoint, and storage prerequisites

**Files:**
- Modify: docs/operations/mcp-oauth-configuration.md
- Modify: docs/operations/mcp-staging-deployment.md
- Create: docs/operations/mcp-production-deployment.md
- Modify: tests/mcp-config.test.ts
- Modify: tests/mcp-oauth-discovery.test.ts
- Modify: tests/mcp-staging-vercel-config.test.ts
- Modify only when the staging contract changes: scripts/deploy-mcp-staging-vercel.sh

- [ ] Inventory production requirements without reading/printing secret values:
  - api.maxvideoai.com DNS and TLS;
  - production MCP Vercel project/routing;
  - production Supabase OAuth 2.1 authorization server, dynamic client registration, PKCE, JWKS, redirect policy, consent, refresh, revocation;
  - Neon production migrations;
  - wallet/Stripe handoff secret;
  - provider credentials and mode gates;
  - durable S3 media paths and least-privilege IAM;
  - cron/poll/reconciliation/cleanup secrets;
  - monitoring and incident contacts.
- [ ] Keep the existing production OAuth discovery disabled until a reviewed rollout action. Staging evidence does not authorize production Supabase changes.
- [ ] Add read-only preflight commands that verify variable names/targets and public discovery endpoints without decrypting secrets.
- [ ] Define migration order, smoke checks, kill switches, and rollback for transport, OAuth, paid generation, reference uploads, marketing, and indexing separately.
- [ ] Run config/discovery tests and commit documentation/code guards.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-config.test.ts tests/mcp-oauth-discovery.test.ts tests/mcp-staging-vercel-config.test.ts
    git add docs/operations/mcp-oauth-configuration.md docs/operations/mcp-staging-deployment.md docs/operations/mcp-production-deployment.md tests/mcp-config.test.ts tests/mcp-oauth-discovery.test.ts tests/mcp-staging-vercel-config.test.ts scripts/deploy-mcp-staging-vercel.sh
    git commit -m "docs(mcp): define production deployment contract"

## Task 7: Complete security, legal, privacy, and support readiness

**Files:**
- Modify: docs/operations/mcp-support-runbook.md
- Modify: docs/operations/mcp-paid-generation-runbook.md
- Modify: docs/marketing/mcp-public-claims-matrix.md
- Modify after legal approval: frontend/messages/en.json
- Modify after legal approval: frontend/messages/fr.json
- Modify after legal approval: frontend/messages/es.json
- Modify: tests/mcp-legal-support-readiness.test.ts
- Modify: tests/mcp-response-headers.test.ts
- Modify: tests/mcp-audit-events.test.ts

- [ ] Verify scopes, consent copy, data minimization, token expiry/refresh/revocation, account deletion effects, media retention, and processor disclosures.
- [ ] Verify audit events omit prompts, private URLs, tokens, payment details, and provider credentials.
- [ ] Document customer support paths for auth, credits, stale quotes, jobs, references, refunds, reconnect, and account library.
- [ ] Define incident severity, status-page owner, provider outage behavior, refund reconciliation, and emergency capability disablement.
- [ ] Confirm Terms/Privacy/AUP support connected generation and third-party assistant processing in EN/FR/ES; route changes through the legal owner.
- [ ] Run security/support contract tests and commit approved changes.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-legal-support-readiness.test.ts tests/mcp-response-headers.test.ts tests/mcp-audit-events.test.ts
    git add docs/operations/mcp-support-runbook.md docs/operations/mcp-paid-generation-runbook.md docs/marketing/mcp-public-claims-matrix.md frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json tests/mcp-legal-support-readiness.test.ts tests/mcp-response-headers.test.ts tests/mcp-audit-events.test.ts
    git commit -m "docs(mcp): close public trust requirements"

## Task 8: Record real-host compatibility

**Files:**
- Modify: frontend/config/mcp-compatibility.json
- Modify: docs/operations/mcp-host-compatibility-matrix.md
- Modify: docs/marketing/mcp-launch-evidence.md
- Modify: tests/mcp-tool-selection-eval.test.ts
- Modify: tests/mcp-marketing-copy.test.ts

- [ ] On the final staging revision, run separate clean-account evidence for:
  - ChatGPT supported plugin/app surface;
  - Codex desktop/plugin surface;
  - Codex CLI if publicly documented;
  - Claude Desktop remote connector;
  - Claude Code HTTP connector;
  - one generic MCP SDK compatibility probe.
- [ ] For each claimed surface record version, install path, OAuth deny/approve, requested scopes, refresh, tool rendering, output rendering, top-up link, upload link, explicit confirmation, recovery, library, revoke, reconnect, and removal.
- [ ] Use the deterministic evaluation corpus for selection quality; do not substitute a successful tools/list response for conversational behavior.
- [ ] Update compatibility JSON only with observed facts and dates. Keep surface-specific failures surface-specific.
- [ ] Run tests and commit evidence.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-tool-selection-eval.test.ts tests/mcp-marketing-copy.test.ts tests/mcp-connect-actions-runtime.test.ts
    git add frontend/config/mcp-compatibility.json docs/operations/mcp-host-compatibility-matrix.md docs/marketing/mcp-launch-evidence.md tests/mcp-tool-selection-eval.test.ts tests/mcp-marketing-copy.test.ts tests/mcp-connect-actions-runtime.test.ts
    git commit -m "docs(mcp): record final host compatibility"

## Task 9: Run a controlled production release

**Files:**
- Modify only during an authorized release: frontend/config/mcp-publication.json
- Modify only during an authorized release: production Vercel/Supabase/DNS state
- Record: docs/marketing/mcp-launch-evidence.md
- Record: docs/operations/mcp-production-deployment.md

- [ ] Obtain explicit authorization for the production deployment and exact capability flags. Do not infer it from approval of this plan.
- [ ] Release in reversible layers:
  1. production transport/discovery with marketing hidden;
  2. OAuth and read-only tools;
  3. paid quote/confirmation/recovery;
  4. reference uploads and cleanup;
  5. public marketing, still noindex;
  6. hosted compatibility smoke;
  7. public indexing/internal links/llms/sitemap;
  8. optional trial claim only if the entitlement is operational.
- [ ] Verify account ownership, wallet, quote, confirmation, provider submission, polling, durable storage, library, refund, top-up, reference cleanup, revocation, rate limits, and audit logs after each capability layer.
- [ ] Roll back the smallest affected flag on failure. Do not disable working ModelArk modes because LAS V2V fails.
- [ ] Record deployment ID, commit SHA, flag state, evidence IDs, and rollback result without secret values.
- [ ] Run full release checks:

    pnpm mcp:catalog:check
    pnpm run test:validate
    pnpm --prefix frontend run i18n:check
    pnpm --prefix frontend run seo:check
    pnpm --prefix frontend run lint
    pnpm --dir frontend exec tsc --noEmit
    pnpm run lint:exposure
    git diff --check

## Task 10: Publish distribution surfaces in controlled order

**Files:**
- Modify: docs/marketing/mcp-directory-submissions.md
- Modify: docs/marketing/mcp-launch-evidence.md
- Modify after targets exist: frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts
- Modify after targets exist: plugins/maxvideoai/README.md

- [ ] Make manual website installation public first. It does not depend on an OpenAI, Anthropic, MCP Registry, or third-party directory listing.
- [ ] Publish the approved GitHub repository/release after production installation is stable.
- [ ] Recheck official OpenAI plugin/app directory requirements and submit only after the final ChatGPT artifact, test account, privacy/support URLs, and production endpoint pass review.
- [ ] Offer Claude custom remote-connector instructions regardless of directory eligibility. Recheck current Anthropic directory policy; do not submit if AI media generation remains excluded.
- [ ] Recheck official MCP Registry schema, ownership, metadata licensing, immutability/unpublish policy, and namespace verification before publishing.
- [ ] Evaluate curated directories individually for ownership, update/removal, security, backlink quality, and spam risk.
- [ ] For every external action, present the exact payload and destination to the user, obtain approval, submit once, and record the returned status.
- [ ] Never say listed, approved, verified, partnered, or endorsed before the public listing is visible and rechecked.

## Task 11: Monitor revenue, quality, and rollback after launch

**Files:**
- Modify: docs/operations/mcp-support-runbook.md
- Modify: docs/marketing/mcp-launch-evidence.md
- Modify: frontend/app/(core)/admin/mcp/_components/AdminMcpView.tsx
- Modify: frontend/app/(core)/admin/mcp/_lib/admin-mcp-helpers.ts
- Modify: tests/admin-mcp-architecture.test.ts
- Modify: tests/admin-mcp-metrics.test.ts
- Modify: tests/admin-mcp-metrics-postgres.test.ts

- [ ] Monitor installation CTA, OAuth completion, first useful tool, quote, top-up recovery, confirmation, completion, library visit, repeat generation, revenue, provider cost, and refund rate by client/source.
- [ ] Add ChatGPT/Claude/Codex/source breakdowns and library/repeat-generation stages to AdminMcpView using the existing server summary; extend admin metric tests before changing the component.
- [ ] Monitor protocol errors, auth refresh/revocation, quote expiry, provider failures, polling delay, storage copy, reference cleanup, and output-schema validation.
- [ ] Define actionable thresholds and the exact flag/owner for each rollback; avoid a single global off switch when one mode/provider is unhealthy.
- [ ] Review search indexing, queries, AI referrals, citations, and brand mentions without manufacturing community posts or reviews.
- [ ] Feed observed user confusion back into tool descriptions, answer passages, docs, and the shared skill; keep model facts live rather than copying support answers into the skill.
