# MaxVideoAI Plugin Acquisition, SEO, and GEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Make MaxVideoAI discoverable and commercially convincing as the video-production layer for ChatGPT and Claude, while retaining Codex and MCP search intent, strong internal linking, verifiable proof, and AI-search-ready answer content.

**Architecture:** Keep one commercial hub at /mcp, add a distinct ChatGPT intent owner, retain Claude/Codex client guides, and keep protocol detail in /docs/mcp. Render acquisition facts server-side. The homepage gains a conversation-led module after comparisons and before the existing reference workflow. Publication state controls routing/indexing; trial copy is an independent promotion rather than an indexation prerequisite.

**Tech Stack:** Next.js App Router, React Server Components, localized EN/FR/ES content, Tailwind design tokens, JSON-LD, sitemap, robots, llms.txt, Google Analytics events, Playwright/Lighthouse.

**Spec:** docs/superpowers/specs/2026-08-26-maxvideoai-plugin-acquisition-and-continuity-design.md

## Global Constraints

- Use “MaxVideoAI for ChatGPT and Claude” or “AI video plugin” for broad prospects; use “MCP server” in technical documentation and secondary SEO copy.
- Do not name the product “ChatGPT Codex”. Say “works in ChatGPT and Codex” where current evidence supports both.
- Lead with ChatGPT, then Claude, then Codex/compatible clients.
- Do not make generic economy/balanced/premium boxes the recommendation UI. Show a conversation, concrete proposals, live trade-offs, and user choice.
- Do not hard-code model counts, prices, modes, or freshness dates in marketing components.
- Keep official ChatGPT/OpenAI and Claude marks visually equal and follow stored brand asset policy.
- Do not add FAQ structured data to commercial pages; visible Q&A and supported application/breadcrumb/media schemas are sufficient.
- Do not request indexing or change production flags during this implementation plan.

## Implementation status — 2026-08-26

| Task | State | Current result / remaining gate |
| --- | --- | --- |
| 1. Vocabulary and copy | Complete | Outcome-first EN/FR/ES copy leads with ChatGPT and Claude, exact price and creative freedom. Internal rollout language is absent from the hero and buying answers. |
| 2. ChatGPT route | Implementation complete; host evidence pending | The localized intent owner, setup, metadata, sitemap and compatibility record exist. A real graphical ChatGPT connection still needs to be recorded before claiming that exact host as verified. |
| 3. Conversation and proposals | Complete except real media proof | The hub shows a user conversation, a quality-first proposal, validated cheaper alternatives and creative-attempt policy. Live per-shot prices remain as clearly labelled references, not packages or static recommendation tiers. |
| 4. Homepage module | Complete | The light-first/dark-compatible module sits after comparisons and before reference workflow with equal official ChatGPT and Claude marks. |
| 5. Real product proof | Pending | No provider sample or synthetic testimonial is used. One deliberately small, owned, job-backed generation may fill this gate after budget approval. |
| 6. Publication semantics | Complete | Trial is independent from indexation and every checked-in publication flag remains false. |
| 7. Internal linking | Complete | Homepage, footer, pay-as-you-go, model hub, selected model pages, comparisons, examples and docs use localized gate-aware anchors. |
| 8. SEO/GEO/docs | Complete for branch | Five localized intent owners, `llms.txt`, sitemap, answer passages, 13-tool docs, live GSC baseline and GEO review are implemented. Production indexation remains deliberately off. |
| 9. Revenue measurement | Implemented; production observation pending | Bounded attribution and funnel events cover landing through funding/generation without storing prompts, tokens or private URLs. Real conversion data starts only after publication. |
| 10. Verification | Complete for branch | The isolated production fixture passes 5 applicable browser tests (2 fixture-mode scenarios skipped), renders 763 static pages, captures responsive light/dark evidence, and scores 94–95 performance and 100 accessibility in Lighthouse. TypeScript, ESLint, i18n, SEO, exposure, registry, contract, and diff checks pass. |

The original draft proposed deleting `mcp-budget-options.ts`. The implementation
keeps its canonical live-price derivation only for small “per-shot price
reference” links. It no longer controls the recommendation hierarchy: the
conversation presents the best current fit first and cheaper alternatives only
when they answer the user’s budget request.

---

## Task 1: Replace the prospect-facing vocabulary and copy model

**Files:**
- Modify: frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-types.ts
- Modify: frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts
- Modify: frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts
- Modify: tests/mcp-marketing-copy.test.ts
- Modify: tests/mcp-marketing-visual-contract.test.ts

- [ ] Replace exact-copy tests first with the approved primary promise:

    Turn ChatGPT or Claude into your AI video producer.
    Plan the shots, prepare prompts and references, compare the right models,
    see the exact price, and generate only after you approve.

- [ ] Change McpClientId to chatgpt | claude | codex. Model ChatGPT and Claude as primary actions and Codex as a supported secondary path.
- [ ] Remove previewIntro, broad gatedBody duplicates, “Task 10”, “local implementation”, “host validation in progress”, “candidate procedure”, and “unverified setup” from public copy types and locale content.
- [ ] Preserve precise qualifications only where they change a decision: supported ChatGPT surface, per-model reference support, optional trial eligibility, and client-specific install steps.
- [ ] Replace “low-cost models first” with quality-first choice plus current lower-cost alternatives. Keep “Price before you generate” as a core phrase.
- [ ] Write complete natural EN/FR/ES copy.
- [ ] Run focused tests and commit.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-marketing-copy.test.ts tests/mcp-marketing-visual-contract.test.ts
    git add 'frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-types.ts' 'frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts' 'frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts' tests/mcp-marketing-copy.test.ts tests/mcp-marketing-visual-contract.test.ts
    git commit -m "copy(mcp): lead with chatgpt and claude outcomes"

## Task 2: Add the ChatGPT acquisition and installation route

**Files:**
- Create: frontend/app/(localized)/[locale]/(marketing)/integrations/chatgpt/page.tsx
- Create: frontend/app/integrations/chatgpt/page.tsx
- Modify: frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts
- Modify: frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-jsonld.ts
- Modify: frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility.ts
- Modify: frontend/config/mcp-compatibility.json
- Modify: frontend/config/mcp-client-actions.json
- Modify: frontend/lib/mcp-publication.ts
- Modify: tests/mcp-marketing-route-architecture.test.ts
- Modify: tests/mcp-host-routing.test.ts

- [ ] Copy the thin server-orchestrator architecture of Claude/Codex; do not duplicate page sections in the route.
- [ ] Give ChatGPT its own intent owner: “AI Video Generator for ChatGPT — MaxVideoAI” and “Create AI video from your ChatGPT conversation”.
- [ ] Use the current OpenAI plugin/app install path supported by hosted evidence. Cross-link to Codex for technical/CLI use without merging the intent owners.
- [ ] Add a chatgpt client action with deep link off until a verified install deep link exists.
- [ ] Add exact localized route recognition for EN, FR, and ES.
- [ ] Add compatibility evidence for the exact tested ChatGPT surface rather than a generic OpenAI status.
- [ ] Run route/metadata tests and commit.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-marketing-route-architecture.test.ts tests/mcp-host-routing.test.ts tests/mcp-marketing-copy.test.ts
    git add 'frontend/app/(localized)/[locale]/(marketing)/integrations/chatgpt/page.tsx' frontend/app/integrations/chatgpt/page.tsx 'frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts' 'frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-jsonld.ts' 'frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility.ts' frontend/config/mcp-compatibility.json frontend/config/mcp-client-actions.json frontend/lib/mcp-publication.ts tests/mcp-marketing-route-architecture.test.ts tests/mcp-host-routing.test.ts tests/mcp-marketing-copy.test.ts
    git commit -m "feat(marketing): add chatgpt video integration page"

## Task 3: Redesign the hub around a conversation and proposals

**Files:**
- Modify: frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpPageView.tsx
- Modify: frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpHeroSection.tsx
- Create: frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpConversationProof.tsx
- Create: frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpProposalWorkflowSection.tsx
- Delete after replacement: frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpBudgetShortlist.tsx
- Delete after replacement: frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-budget-options.ts
- Modify: frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpAnswerPassagesSection.tsx
- Modify: frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpTrustSections.tsx
- Modify: frontend/app/(localized)/[locale]/(marketing)/mcp/page.tsx
- Replace: tests/mcp-budget-options.test.ts with tests/mcp-conversation-proof.test.ts
- Modify: tests/mcp-marketing-visual-contract.test.ts

- [ ] Require ChatGPT/Claude equal actions, Codex secondary compatibility, a user brief, one clarification, a quality-first proposal, a factual lower-cost alternative, a quote, approval, and saved-library outcome.
- [ ] Remove the static budget shortlist. Render:

    User brief → assistant clarification → current model proposals
    → exact MaxVideoAI quote → user approval → generation and library

- [ ] Show proposal differences by shot purpose and trade-off. Use mixed models only when the sample brief benefits.
- [ ] Render catalog labels and proof amounts from server data, never locale copy.
- [ ] Keep the page light-first, restrained, and fully dark-compatible.
- [ ] Keep direct answers for definition, choice, price/credits, references, confirmation, library, failure/refund, and disconnect.
- [ ] Run tests and commit.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-conversation-proof.test.ts tests/mcp-marketing-visual-contract.test.ts tests/mcp-marketing-copy.test.ts
    git add -A -- 'frontend/app/(localized)/[locale]/(marketing)/mcp/_components' 'frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-budget-options.ts' 'frontend/app/(localized)/[locale]/(marketing)/mcp/page.tsx' tests/mcp-budget-options.test.ts tests/mcp-conversation-proof.test.ts tests/mcp-marketing-visual-contract.test.ts tests/mcp-marketing-copy.test.ts
    git commit -m "feat(marketing): make mcp hub conversation led"

## Task 4: Add the homepage acquisition module

**Files:**
- Create: frontend/components/marketing/home/HomeAssistantPluginSection.tsx
- Modify: frontend/components/marketing/home/HomeRedesignSections.tsx
- Modify: frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx
- Modify: frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/types.ts
- Modify: frontend/messages/en.json
- Modify: frontend/messages/fr.json
- Modify: frontend/messages/es.json
- Create: tests/home-mcp-acquisition-section.test.ts

- [ ] Add an architecture test requiring the module after ComparisonPreview and before ReferenceWorkflow.
- [ ] Extend RedesignContent with assistantPlugin copy: eyebrow, title, benefit, conversation labels, ChatGPT/Claude CTAs, Codex supporting label, and trust line. Keep model names/prices out of messages.
- [ ] Render equal 24px OpenAI and Claude marks from existing light/dark brand assets.
- [ ] Use the same verified conversation/proof data as the hub, with a smaller presentation.
- [ ] Gate the module through shared publication state; it stays absent while production marketing is closed.
- [ ] Use equal CTA weight: “Use MaxVideoAI in ChatGPT” and “Connect MaxVideoAI to Claude”.
- [ ] Run tests, i18n validation, and commit.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/home-mcp-acquisition-section.test.ts tests/mcp-marketing-visual-contract.test.ts
    pnpm --prefix frontend run i18n:check
    git add frontend/components/marketing/home/HomeAssistantPluginSection.tsx frontend/components/marketing/home/HomeRedesignSections.tsx 'frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx' 'frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/types.ts' frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json tests/home-mcp-acquisition-section.test.ts
    git commit -m "feat(home): introduce chatgpt and claude video workflow"

## Task 5: Capture and publish real product proof

**Files:**
- Modify: docs/marketing/mcp-demo-evidence.md
- Modify: docs/marketing/mcp-asset-provenance.md
- Modify: frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-proof.ts
- Modify: frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpProofMedia.tsx
- Add owned assets: frontend/public/media/mcp/
- Modify: tests/mcp-demo-assets.test.ts
- Modify: tests/mcp-paid-e2e-proof-contract.test.ts

- [ ] Reuse a completed owned staging job when it has job/audit proof and marketing permission. Do not spend credits just to fill the section.
- [ ] If no valid media exists, request a maximum test budget and create one short reusable proof. Record host/version, brief, prompt, references, model/mode/settings, exact quote, confirmation, job/audit IDs, checksum, library visibility, and rights.
- [ ] Create a poster and localized captions from owned evidence. Never reuse a provider sample.
- [ ] Return proof only when every evidence field and local asset validates.
- [ ] Keep video controlled, poster-backed, captioned, muted by default, and non-autoplay.
- [ ] Run tests and commit evidence/assets together.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-demo-assets.test.ts tests/mcp-paid-e2e-proof-contract.test.ts tests/mcp-marketing-visual-contract.test.ts
    git add docs/marketing/mcp-demo-evidence.md docs/marketing/mcp-asset-provenance.md 'frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-proof.ts' 'frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpProofMedia.tsx' frontend/public/media/mcp tests/mcp-demo-assets.test.ts tests/mcp-paid-e2e-proof-contract.test.ts
    git commit -m "feat(marketing): add verified mcp product proof"

## Task 6: Correct publication semantics

**Files:**
- Modify: frontend/lib/mcp-publication.ts
- Keep checked-in false: frontend/config/mcp-publication.json
- Modify: tests/mcp-publication.test.ts
- Modify: tests/mcp-launch-readiness.test.ts
- Modify: scripts/run-mcp-launch-fixture.mjs

- [ ] Replace the trial-dependent indexation rule. Test this exact policy:

    connectionAvailable = publicMarketing && transport && oauth && discovery
    indexable = publicMarketing && publicIndexing && transport && oauth
                && discovery && paidGeneration && referenceUploads

- [ ] Keep showTrialClaim independent. The core product may launch without a free-credit campaign and must then omit trial claims.
- [ ] Keep all checked-in flags false until a separately authorized production release.
- [ ] Cover gated, private-preview, connected-noindex, and fully indexable fixtures.
- [ ] Run tests and commit.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-publication.test.ts tests/mcp-launch-readiness.test.ts
    git add frontend/lib/mcp-publication.ts tests/mcp-publication.test.ts tests/mcp-launch-readiness.test.ts scripts/run-mcp-launch-fixture.mjs
    git commit -m "fix(mcp): decouple trial from indexation"

## Task 7: Expand contextual internal linking

**Files:**
- Modify: frontend/lib/mcp-internal-links.ts
- Modify: frontend/components/marketing/MarketingFooter.tsx
- Modify: frontend/components/marketing/MarketingNav.tsx
- Modify: frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts
- Modify: frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogPricingLimitsSection.tsx
- Modify: frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPrepLinksSection.tsx
- Modify: frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-route-sections.tsx
- Modify: frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareRelatedSection.tsx
- Modify: frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsSectionsGrid.tsx
- Modify: tests/mcp-seo-signals.test.ts

- [ ] Expand placements to home, footer, payg, models, model, comparison, examples, and docs.
- [ ] Give each placement a natural localized anchor. Avoid repeating “MCP”.
- [ ] Link the existing high-impression surfaces identified in GSC: homepage, LTX/Kling examples, Veo models, Seedance comparisons, pricing/pay-as-you-go, and relevant comparison hubs.
- [ ] Put integration navigation behind the indexable gate. Keep all links absent with checked-in false flags.
- [ ] Run SEO/route tests and commit.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-seo-signals.test.ts tests/mcp-marketing-route-architecture.test.ts
    git add frontend/lib/mcp-internal-links.ts frontend/components/marketing/MarketingFooter.tsx frontend/components/marketing/MarketingNav.tsx 'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts' 'frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogPricingLimitsSection.tsx' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPrepLinksSection.tsx' 'frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-route-sections.tsx' 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareRelatedSection.tsx' 'frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsSectionsGrid.tsx' tests/mcp-seo-signals.test.ts tests/mcp-marketing-route-architecture.test.ts
    git commit -m "feat(seo): link assistant video workflows contextually"

## Task 8: Complete SEO, GEO, sitemap, and technical documentation

**Files:**
- Modify: frontend/lib/sitemap/route-discovery.ts
- Modify: frontend/lib/seo/llms-text.ts
- Verify unchanged: frontend/lib/seo/robots-text.ts
- Modify: frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-jsonld.ts
- Modify: frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-jsonld.ts
- Modify: content/docs/mcp.mdx
- Modify: content/fr/docs/mcp.mdx
- Modify: content/es/docs/mcp.mdx
- Modify: docs/marketing/GEO-ANALYSIS.md
- Modify: docs/marketing/mcp-gsc-baseline.md
- Modify: tests/mcp-seo-signals.test.ts
- Modify: tests/mcp-docs-content.test.ts
- Modify: tests/mcp-seo-review-remediation.test.ts

- [ ] Add ChatGPT to the exact five-page sitemap/llms intent set.
- [ ] Describe the hub, ChatGPT, Claude, Codex, and docs pages outcome-first in llms.txt.
- [ ] Preserve current search/user-request crawler access and private/account/API exclusions.
- [ ] Add server-rendered answer passages with direct first-sentence answers for the core buying and usage questions.
- [ ] Derive model counts and freshness. Use visible primary-source/provenance links for platform claims.
- [ ] Use only supported SoftwareApplication/WebApplication, BreadcrumbList, and VideoObject data that matches visible content. No FAQ schema.
- [ ] Rewrite the docs around the twelve-tool contract, credits, library, references, recovery, and revocation.
- [ ] Update the GSC baseline with the verified three-month capture: 6,314 clicks, 491,440 impressions, 1.3% CTR, position 10.2, plus 27,759 generative-feature impressions and limitations.
- [ ] Re-score GEO readiness after implementation.
- [ ] Run SEO/docs checks and commit.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-seo-signals.test.ts tests/mcp-docs-content.test.ts tests/mcp-seo-review-remediation.test.ts
    pnpm --prefix frontend run seo:check
    git add frontend/lib/sitemap/route-discovery.ts frontend/lib/seo/llms-text.ts 'frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-jsonld.ts' 'frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-jsonld.ts' content/docs/mcp.mdx content/fr/docs/mcp.mdx content/es/docs/mcp.mdx docs/marketing/GEO-ANALYSIS.md docs/marketing/mcp-gsc-baseline.md tests/mcp-seo-signals.test.ts tests/mcp-docs-content.test.ts tests/mcp-seo-review-remediation.test.ts
    git commit -m "feat(geo): publish citable plugin acquisition sources"

## Task 9: Measure the acquisition-to-revenue journey

**Files:**
- Modify: frontend/lib/mcp-acquisition.ts
- Modify: frontend/app/api/mcp/acquisition/route.ts
- Modify: frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpConnectActions.client.tsx
- Modify: frontend/src/server/agent-api/mcp-funnel.ts
- Modify: frontend/src/server/agent-api/mcp-oauth-funnel.ts
- Modify: frontend/app/api/stripe/webhook/_lib/stripe-webhook-mcp-attribution.ts
- Modify: tests/mcp-acquisition-attribution.test.ts
- Modify: tests/mcp-funnel.test.ts
- Modify: tests/mcp-funnel-postgres.test.ts
- Modify: tests/mcp-topup-attribution.test.ts

- [ ] Add chatgpt to bounded client/source enums; retain Claude, Codex, direct MCP, GitHub, directory, language, and campaign.
- [ ] Track landing, CTA, OAuth start/completion, first useful tool, quote, top-up handoff, wallet funded, confirmation, accepted, completed, library visit, and repeat generation.
- [ ] Never store prompts, private URLs, tokens, payment data, or OAuth state in acquisition events.
- [ ] Record a library visit only from a real user navigation, not from returning a link.
- [ ] Run tests and commit.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-acquisition-attribution.test.ts tests/mcp-funnel.test.ts tests/mcp-funnel-postgres.test.ts tests/mcp-topup-attribution.test.ts
    git add frontend/lib/mcp-acquisition.ts frontend/app/api/mcp/acquisition/route.ts 'frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpConnectActions.client.tsx' frontend/src/server/agent-api/mcp-funnel.ts frontend/src/server/agent-api/mcp-oauth-funnel.ts frontend/app/api/stripe/webhook/_lib/stripe-webhook-mcp-attribution.ts tests/mcp-acquisition-attribution.test.ts tests/mcp-funnel.test.ts tests/mcp-funnel-postgres.test.ts tests/mcp-topup-attribution.test.ts
    git commit -m "feat(analytics): measure plugin revenue journey"

## Task 10: Browser, accessibility, and performance verification

**Files:**
- Modify: tests/e2e/mcp-acquisition.spec.ts
- Modify: docs/marketing/mcp-launch-evidence.md

- [ ] Start the dedicated branch server and test EN/FR/ES hub, ChatGPT, Claude, Codex, docs, and homepage module.
- [ ] Capture desktop/mobile light/dark screenshots. Verify equal marks, overflow, focus, contrast, captions, and one main landmark.
- [ ] Verify no-JavaScript output includes H1, definition, benefits, answers, links, and proof caption.
- [ ] Verify canonical, hreflang, robots, JSON-LD, sitemap fixture, and llms fixture.
- [ ] Run Lighthouse for home and /mcp; fix regressions caused by the module/media.
- [ ] Run final checks and record exact evidence.

    pnpm qa:mcp-launch:enabled
    pnpm qa:mcp-launch:lighthouse
    pnpm --prefix frontend run i18n:check
    pnpm --prefix frontend run seo:check
    pnpm --prefix frontend run lint
    pnpm --dir frontend exec tsc --noEmit
    git diff --check
    git add tests/e2e/mcp-acquisition.spec.ts docs/marketing/mcp-launch-evidence.md
    git commit -m "test(marketing): verify plugin acquisition experience"
