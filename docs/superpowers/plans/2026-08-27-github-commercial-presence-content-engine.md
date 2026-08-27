# MaxVideoAI GitHub Commercial Presence and Content Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the MaxVideoAI GitHub presence into a conversion, trust, distribution, backlink, and AI-agent discovery engine built around two repositories, current visual proof, a subtly personable commercial voice, and measurable SEO/GEO outcomes.

**Architecture:** Keep `camgraphe/MaxVideoAi` as the authored product and engineering flagship. Keep `plugins/maxvideoai/` in that repository as the only authored plugin source. Publish a reviewed, deterministic subset to `camgraphe/maxvideoai-plugin`, which becomes the focused installation and acquisition surface for ChatGPT, Claude, Codex, and compatible MCP clients. Treat screenshots, machine-facing metadata, answer passages, tool-selection behavior, and measurement as versioned product assets with evidence gates.

**Tech Stack:** GitHub repositories and Actions, Markdown, Node.js/TypeScript contract tests, Next.js App Router, JSON-LD, `llms.txt`, MCP manifests, Claude/Codex plugin manifests, ImageGen for non-evidentiary editorial art, current first-party screenshots for proof, GitHub and MaxVideoAI analytics.

**Spec:** `docs/superpowers/specs/2026-08-27-github-commercial-presence-content-engine-design.md`

## Global Constraints

- Read root `AGENTS.md`, `docs/engineering/llm-working-guide.md`, and the nearest nested `AGENTS.md` before each implementation wave.
- Preserve user changes and check `git status --short --branch` before every task and commit.
- Coordinate with the active Gemini Omni task before any commit. Do not touch its Omni location, readiness, provider, test, or documentation files.
- Keep `plugins/maxvideoai/` as the only authored plugin source. The public plugin repository is a generated and reviewed distribution surface, never a second editable source of truth.
- Do not create the external repository, push to it, enable Discussions, modify GitHub repository settings, publish a registry entry, submit a directory listing, or deploy website changes without the explicit gate in the relevant task.
- Preserve current paid-generation invariants: exact quote, explicit approval, no automatic funding, no automatic paid retry, recoverable jobs, and shared MaxVideoAI library continuity.
- Do not hard-code a model count, price, mode, or availability claim in GitHub copy. Link to or derive current catalog facts from MaxVideoAI.
- Do not claim a ChatGPT, Claude, Codex, registry, or directory surface as live until evidence exists for that exact product, host, install path, and version.
- Keep current crawler policy intact: retrieval/search crawlers may access public acquisition content while training-only crawlers remain blocked. A GEO score is not authority to change that policy.
- Never use a generated image as host, installation, price, approval, compatibility, benchmark, testimonial, or result evidence.
- Re-capture or explicitly revalidate every public screenshot. Existing files under `frontend/public/media/mcp/` are reference-only until a new asset record proves freshness.
- Commercial English should sound like a calm, friendly, capable producer: direct, lightly conversational, precise about money, and free of fake urgency, emoji walls, forced jokes, generic hype, or long qualification dumps.
- No principal README may contain more than 220 consecutive prose words without a useful screenshot, video/GIF, code block, comparison table, workflow diagram, or concrete example. No more than two consecutive H2 sections may be text-only.
- Keep GitHub-visible assets readable at their rendered size, not only at source resolution. Verify crops at desktop and narrow GitHub widths.
- Use the scorecard in this plan as an internal evidence rubric, not as an industry benchmark or traffic forecast. Targets are never reported as achieved values.
- Keep every commit focused. Run the listed task checks plus `git diff --check` before committing.

## Delivery Map

| Wave | Tasks | Outcome | Hard gate |
| --- | --- | --- | --- |
| A — Measurement and editorial contracts | 1–3 | Reproducible baseline, voice contract, visual cadence, asset provenance, freshness checks | None |
| B — Current proof | 4–5 | Fresh host/product captures and final proof-led visual set | Exact-host evidence and privacy review |
| C — Repository transformation | 6–11 | Focused plugin package, deterministic public mirror, dedicated repository, commercial flagship README | Owner approval before external repository mutation |
| D — Human and machine GEO | 12–14 | Consistent metadata, answer passages, `llms.txt`, agent-selection evaluation, registry packet | No unsupported host or directory claim |
| E — Distribution and compounding content | 15–17 | Backlink program, editorial cadence, source attribution, launch reporting | Each listing/outreach target revalidated before action |
| F — Verified closeout | 18 | Before/target/after score, remaining gaps, and ordered next-task queue | Every after-score has evidence |

The critical path is `1 → 2 → 3 → 4 → 5 → 6 → 8 → 9 → 10 → 11 → 12 → 13 → 15 → 16 → 17 → 18`. Task 7 can run after Task 2 and before Task 8. Task 14 can run after Tasks 6 and 12 but remains independent of public directory submission.

## Baseline Score at Plan Approval

This baseline combines the 2026-08-27 repository audit, `docs/marketing/GEO-ANALYSIS.md`, the current READMEs, current package manifests, the existing screenshot inventory, and current distribution evidence. It must be copied into the machine-readable scorecard in Task 1.

| Dimension | Weight | Before | Target | Evidence behind the before score |
| --- | ---: | ---: | ---: | --- |
| Conversion clarity | 15% | 30 | 80 | Root README is development-first; plugin value exists but is not composed as a fast commercial path. |
| Editorial personality | 10% | 42 | 85 | Copy is competent and precise but often reads like a release contract or default explanation rather than a helpful producer. |
| Visual proof and rhythm | 15% | 28 | 85 | Useful captures exist, but they are stale/reference-only and long text stretches remain. No custom GitHub social preview exists. |
| GitHub SEO | 10% | 62 | 85 | Relevant terms and platform pages exist, but repository titles, descriptions, topics, first-screen copy, and public plugin repo are incomplete. |
| Human-facing GEO | 10% | 58 | 88 | Strong answer architecture exists; public proof, public GitHub distribution, and earned citations are missing. |
| Agent discovery and selection | 15% | 68 | 90 | Skills, manifests, MCP tools, and offline policy eval exist; named Claude/Codex discovery coverage and public machine-readable distribution are incomplete. |
| Trust and evidence | 10% | 64 | 90 | Exact-price and safety contracts are strong; current host proof, community files, license clarity, and public release evidence remain incomplete. |
| Distribution and backlinks | 10% | 18 | 75 | No dedicated public plugin repository, official registry listing, maintained listing set, or earned-link program is live. |
| Measurement and iteration | 5% | 45 | 85 | MCP funnel attribution exists, but GitHub-specific source mapping, clean baselines, and a recurring score closeout are not established. |
| **Weighted total** | **100%** | **46** | **85** | Rounded from 45.55 before and 84.80 target. |

`After` starts as `null`. It may be populated only in Task 18 after the referenced evidence exists.

---

## Task 1: Create the GitHub transformation scorecard and evidence contract

**Files:**
- Create: `docs/marketing/github-content-scorecard.json`
- Create: `docs/marketing/github-growth-scorecard.md`
- Create: `scripts/github-content-score.mjs`
- Create: `tests/github-content-score.test.ts`
- Modify: `package.json`

**Interfaces:**

```ts
type GithubScoreDimension = {
  id: 'conversion' | 'voice' | 'visual' | 'seo' | 'human_geo' |
    'agent_discovery' | 'trust' | 'distribution' | 'measurement';
  label: string;
  weight: number;
  before: number;
  target: number;
  after: number | null;
  beforeEvidence: string[];
  afterEvidence: string[];
};
```

The JSON top level is `{ version: 1, assessedAt: '2026-08-27', rubric, dimensions }`. Evidence entries are repository-relative paths or public URLs. A target is never accepted as after-evidence.

- [ ] Write a failing test that requires the nine exact dimension IDs, weights totaling 100, values between 0 and 100, the baseline and target numbers in this plan, `after: null`, and empty `afterEvidence` arrays.
- [ ] Write a failing test that rejects an `after` value when `afterEvidence` is empty, a missing evidence file, a target copied to `after` without independent evidence, or a weighted total labeled as an external benchmark.
- [ ] Run the test and confirm failure because the scorecard and script do not exist.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/github-content-score.test.ts

- [ ] Implement `scripts/github-content-score.mjs` with `--format markdown|json` and `--require-after`. The default command prints before, target, current after, and weighted totals. `--require-after` exits non-zero while any after value is null or unsupported.
- [ ] Create the JSON with the baseline above. Use precise evidence paths including `README.md`, `plugins/maxvideoai/README.md`, `docs/marketing/GEO-ANALYSIS.md`, `docs/marketing/mcp-tool-selection-scorecard.md`, and the existing screenshot paths.
- [ ] Create `docs/marketing/github-growth-scorecard.md` explaining that 46 is an evidence-based internal baseline, 85 is the planned target, and the after score remains unmeasured until Task 18.
- [ ] Add `"github:score": "node scripts/github-content-score.mjs"` to `package.json`.
- [ ] Run the focused test and baseline command.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/github-content-score.test.ts
    pnpm github:score -- --format markdown
    git diff --check

- [ ] Commit.

    git add docs/marketing/github-content-scorecard.json docs/marketing/github-growth-scorecard.md scripts/github-content-score.mjs tests/github-content-score.test.ts package.json
    git commit -m "test(github): establish commercial presence scorecard"

## Task 2: Encode the subtly personable voice and visual-rhythm rules

**Files:**
- Create: `docs/marketing/github-editorial-voice.md`
- Create: `docs/marketing/github-visual-style.md`
- Create: `scripts/check-github-content.mjs`
- Create: `tests/github-content-contract.test.ts`
- Create: `tests/fixtures/github-content/compliant.md`
- Create: `tests/fixtures/github-content/hype.md`
- Create: `tests/fixtures/github-content/text-wall.md`

**Editorial contract:**

- Voice traits: capable producer, subtle warmth, direct guidance, respect for the user's spend, proof before superlatives.
- Preferred verbs: plan, compare, budget, quote, approve, generate, recover, reuse.
- Allowed conversational turns: “Bring the brief.”, “You stay in control of the spend.”, “Pick up where the conversation left off.”
- Banned commercial shortcuts: “revolutionary”, “game-changing”, “ultimate”, “unleash”, “effortless magic”, urgency countdowns, emoji-led headings, invented social proof, and competitive claims without evidence.
- Qualification rule: place a compatibility, price, privacy, or install qualification beside the affected claim; do not open with a wall of caveats.

**Visual contract:**

- A real visual or install block appears within the first 60 README lines.
- No more than 220 consecutive prose words appear without a useful visual break.
- No more than two consecutive H2 sections are text-only.
- Every image has descriptive alt text; “screenshot”, “image”, and “demo” alone are invalid.
- Decorative ImageGen art is labeled editorial and cannot satisfy a proof requirement.

- [ ] Write fixture tests first. The compliant fixture passes; the hype fixture fails banned-language and unsupported-superlative rules; the text-wall fixture fails cadence rules.
- [ ] Run and confirm failure because the checker does not exist.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/github-content-contract.test.ts

- [ ] Implement a small Markdown scanner using Node built-ins. Count prose words between image, fenced-code, table, video/GIF, and explicit `<picture>` breaks. Track consecutive H2 sections and alt text quality.
- [ ] Keep the checker path-driven: `node scripts/check-github-content.mjs README.md plugins/maxvideoai/README.md`. Do not enforce the production READMEs in CI until Tasks 6 and 11 have rewritten them.
- [ ] Write the voice guide with paired “flat → MaxVideoAI” examples. At least six pairs must cover model choice, price, approval, recovery, library continuity, and installation.
- [ ] Write the visual guide with the exact 60-line, 220-word, and two-H2 thresholds; placement sizes; proof-versus-editorial rules; mobile crop checks; and alt-text examples.
- [ ] Run tests and commit.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/github-content-contract.test.ts
    git diff --check
    git add docs/marketing/github-editorial-voice.md docs/marketing/github-visual-style.md scripts/check-github-content.mjs tests/github-content-contract.test.ts tests/fixtures/github-content
    git commit -m "docs(github): define voice and visual rhythm contracts"

## Task 3: Create the asset manifest, freshness policy, and release gate

**Files:**
- Create: `docs/marketing/github-asset-manifest.json`
- Create: `scripts/check-github-assets.mjs`
- Create: `scripts/register-github-asset.mjs`
- Create: `tests/github-assets.test.ts`
- Modify: `docs/marketing/mcp-asset-provenance.md`
- Modify: `package.json`

**Asset states:** `reference_only`, `draft_editorial`, `publishable_proof`, `retired`.

**Required record interface:**

```ts
type GithubAssetRecord = {
  id: string;
  path: string;
  kind: 'host_proof' | 'product_proof' | 'editorial';
  state: 'reference_only' | 'draft_editorial' | 'publishable_proof' | 'retired';
  capturedAt: string;
  sourceEnvironment: 'production' | 'controlled_demo' | 'generated_editorial';
  host: string | null;
  hostVersion: string | null;
  maxvideoaiRevision: string;
  width: number;
  height: number;
  sha256: string;
  claim: string;
  placements: string[];
  alt: string;
  reviewTrigger: string;
  approvedBy: string | null;
};
```

- [ ] Write failing tests for schema, semantic IDs, safe relative paths, 64-character hashes, real dimensions, non-empty claims, descriptive alt text, allowed states, and host-version requirements for host proof.
- [ ] Add a release-mode test requiring every asset referenced by either production README to be `publishable_proof` or an explicitly labeled `draft_editorial` asset used only decoratively.
- [ ] Seed the manifest with current `frontend/public/media/mcp/*` and relevant marketing screenshots as `reference_only`. Record actual hashes and dimensions; do not backfill fake capture versions.
- [ ] Implement `register-github-asset.mjs` to calculate SHA-256 and read PNG/JPEG/WebP dimensions. Use Node built-ins for hashing and a deterministic dimension parser; do not depend on macOS-only metadata tools in CI.
- [ ] Implement `check-github-assets.mjs` with default and `--release` modes. Default validates every existing record. Release mode additionally scans README image references and rejects missing/unapproved/stale records.
- [ ] Add `"github:assets:check": "node scripts/check-github-assets.mjs"` and `"github:assets:release-check": "node scripts/check-github-assets.mjs --release"`.
- [ ] Update `mcp-asset-provenance.md` to point to the machine-readable manifest and to state that the old files are shot-list references only.
- [ ] Run and commit.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/github-assets.test.ts
    pnpm github:assets:check
    git diff --check
    git add docs/marketing/github-asset-manifest.json docs/marketing/mcp-asset-provenance.md scripts/check-github-assets.mjs scripts/register-github-asset.mjs tests/github-assets.test.ts package.json
    git commit -m "build(github): enforce screenshot freshness and provenance"

## Task 4: Capture current Claude, Codex, ChatGPT, and MaxVideoAI proof

**Files:**
- Create when verified: `plugins/maxvideoai/assets/screenshots/claude-connected-production.jpg`
- Create when verified: `plugins/maxvideoai/assets/screenshots/claude-project-plan-production.jpg`
- Create when verified: `plugins/maxvideoai/assets/screenshots/claude-exact-quote-production.jpg`
- Create when verified: `plugins/maxvideoai/assets/screenshots/claude-finished-video-production.jpg`
- Create when verified: `plugins/maxvideoai/assets/screenshots/codex-plugin-installed-production.jpg`
- Create when verified: `plugins/maxvideoai/assets/screenshots/codex-project-plan-production.jpg`
- Create when verified: `plugins/maxvideoai/assets/screenshots/codex-exact-quote-production.jpg`
- Create when verified: `plugins/maxvideoai/assets/screenshots/codex-finished-video-production.jpg`
- Create only after exact-host verification: `plugins/maxvideoai/assets/screenshots/chatgpt-connected-production.jpg`
- Create only after exact-host verification: `plugins/maxvideoai/assets/screenshots/chatgpt-exact-quote-production.jpg`
- Create only after exact-host verification: `plugins/maxvideoai/assets/screenshots/chatgpt-finished-video-production.jpg`
- Create: `plugins/maxvideoai/assets/screenshots/maxvideoai-library-continuity-production.jpg`
- Create: `plugins/maxvideoai/assets/screenshots/maxvideoai-workspace-production.jpg`
- Create: `plugins/maxvideoai/assets/screenshots/maxvideoai-reference-workflow-production.jpg`
- Modify: `docs/marketing/github-asset-manifest.json`
- Modify: `docs/marketing/mcp-demo-evidence.md`
- Modify: `docs/marketing/mcp-launch-evidence.md`

- [ ] Before capture, record the current branch SHA, production deployment identity, host name/version, browser/app viewport, demo account, public-safe source media, and intended claim.
- [ ] Use only a dedicated demo account. Hide emails, balances that are not intentionally public, tokens, private references, personal tabs, notifications, internal IDs, staging origins, and unrelated projects.
- [ ] Re-run the complete flow on each exact host: connect → account check → model/project choice → exact quote → explicit approval → accepted generation → completed result → MaxVideoAI library.
- [ ] For Claude and Codex, replace every older shot used by the new README composition even if the older screen still looks plausible.
- [ ] For ChatGPT, stop at `not_verified` if a supported production install and complete flow cannot be exercised. Do not create a simulated ChatGPT screenshot and do not let the README imply verified availability.
- [ ] Capture independent source images at readable density. Preserve enough host chrome to identify the surface, while keeping the MaxVideoAI action/result dominant.
- [ ] Inspect each asset at original resolution and at the intended rendered width. Reject blurry text, clipped controls, ambiguous approval state, and result frames that do not visibly match the recorded job.
- [ ] Register each accepted file with `register-github-asset.mjs`; add claim and approval metadata; mark superseded files `reference_only` or `retired` rather than silently reusing them.
- [ ] Update evidence docs with the exact job/evidence record while keeping secrets and private prompt data out of Git.
- [ ] Run the asset checker and focused existing proof tests.

    pnpm github:assets:check
    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/github-assets.test.ts tests/mcp-demo-assets.test.ts tests/mcp-host-proof.test.ts
    git diff --check

- [ ] Commit only verified captures and records.

    git add plugins/maxvideoai/assets/screenshots docs/marketing/github-asset-manifest.json docs/marketing/mcp-demo-evidence.md docs/marketing/mcp-launch-evidence.md
    git commit -m "docs(plugin): refresh current host and product proof"

## Task 5: Produce the final proof-led visual system

**Files:**
- Create: `plugins/maxvideoai/assets/demos/readme-proof-hero.webp`
- Create: `plugins/maxvideoai/assets/demos/brief-to-video-workflow.webp`
- Create: `plugins/maxvideoai/assets/demos/model-choice-and-budget.webp`
- Create: `plugins/maxvideoai/assets/demos/library-continuity.webp`
- Create: `plugins/maxvideoai/assets/social/github-social-preview.png`
- Create: `plugins/maxvideoai/assets/social/release-0.3.0.png`
- Create: `plugins/maxvideoai/assets/social/directory-thumbnail.png`
- Modify: `docs/marketing/github-asset-manifest.json`
- Modify: `docs/marketing/mcp-asset-provenance.md`

**Approved composition:** concise promise and install on the left; large real finished-result proof on the right; restrained ChatGPT/Claude/Codex compatibility line; three compact benefits; secondary plugin/workflow proof; generous white space; black, white, and MaxVideoAI cobalt.

**ImageGen editorial prompt:**

```text
Create a restrained editorial background system for MaxVideoAI GitHub launch assets.
Use a clean black, white and cobalt palette, generous negative space, subtle cinematic
light, and one abstract visual idea: a single creative brief branching into several
controlled video-production paths and converging into one finished result. No text,
no logos, no UI, no browser chrome, no fake screenshots, no price, no platform marks,
no people presenting a product, no neon sci-fi dashboard. Premium editorial design,
quiet confidence, crisp geometry, suitable behind real screenshots at 1280x640.
```

- [ ] Measure every target slot before composition: 1280×640 social preview under 1 MB; 1600×900 README composites; 1200×630 release card; 1200×675 directory thumbnail.
- [ ] Use ImageGen only for the restrained editorial background. Keep the raw generation as a design source, not as product proof.
- [ ] Build the README composites from the fresh Task 4 screenshots. Do not redraw, alter, or fabricate UI text, price, approval, output, or platform chrome.
- [ ] Use one real MaxVideoAI-produced media frame as the dominant finished-result proof and record its safe prompt summary, model, settings, generation date, and publication permission.
- [ ] Keep text outside raster images whenever Markdown can render it accessibly. Social/release cards may contain only the approved short promise and release label.
- [ ] Inspect every composite at actual GitHub width, at 50% scale, and against both light and dark surrounding UI.
- [ ] Run image optimization without upscaling. Verify dimensions, file size, legibility, alt text, and manifest hashes.
- [ ] Register assets as `publishable_proof` when their core is current evidence, or `draft_editorial` when purely decorative. The manifest claim must distinguish those states.
- [ ] Run and commit.

    pnpm github:assets:check
    git diff --check
    git add plugins/maxvideoai/assets/demos plugins/maxvideoai/assets/social docs/marketing/github-asset-manifest.json docs/marketing/mcp-asset-provenance.md
    git commit -m "design(plugin): add proof-led GitHub visual system"

## Task 6: Rewrite the plugin README as the conversion surface

**Files:**
- Modify: `plugins/maxvideoai/README.md`
- Create: `plugins/maxvideoai/docs/chatgpt.md`
- Create: `plugins/maxvideoai/docs/claude.md`
- Create: `plugins/maxvideoai/docs/codex.md`
- Create: `plugins/maxvideoai/docs/generic-mcp.md`
- Create: `plugins/maxvideoai/docs/privacy-and-permissions.md`
- Create: `plugins/maxvideoai/docs/troubleshooting.md`
- Create: `plugins/maxvideoai/docs/how-it-works.md`
- Modify: `tests/mcp-plugin-contract.test.ts`
- Modify: `tests/github-content-contract.test.ts`

**First-screen copy:**

```md
# MaxVideoAI for ChatGPT, Claude & Codex

AI video production inside the conversation.

Plan the production, compare current models, see the exact price, approve the
spend, and recover the finished result in your MaxVideoAI library.

**Plan. Compare. Price. Approve. Generate.**
```

The first screen must also contain the current compatibility line, one verified install path, and `readme-proof-hero.webp`. If ChatGPT evidence is not yet complete, use “Designed for ChatGPT; verified today in Claude and Codex” beside the exact status link rather than a generic compatibility claim.

- [ ] Write failing contract assertions for the approved H1, outcome, five-beat rhythm, current hero image, install command/link, exact-price language, approval boundary, recovery/library continuity, named platform docs, and a visible compatibility-evidence link.
- [ ] Assert the README does not contain static model counts/prices, “Generate Page Mock”, internal task vocabulary, generic hype, stale screenshots, invented host claims, or more than 220 prose words without a visual break.
- [ ] Run the tests and confirm the current README fails the new conversion contract.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-plugin-contract.test.ts tests/github-content-contract.test.ts

- [ ] Rewrite in this exact order: hero and proof; install chooser; “See it work” visual sequence; three compact benefits; plan a production; exact price and approval; result recovery/library; references; platform guides; permissions; troubleshooting; contributing/support; license/security.
- [ ] Keep the main README under 1,800 words. Move platform detail into the new guides and architecture detail into `how-it-works.md`.
- [ ] Give each platform guide one exact, tested install path; one first request; one expected tool/response; one screenshot; one disconnect/update path; and a link to evidence status.
- [ ] Write setup copy in the subtle producer voice. Example: “Bring the brief. MaxVideoAI can turn it into a shot plan before you spend a credit.”
- [ ] Add canonical tracked links to MaxVideoAI `/mcp`, model comparison, pricing, library, privacy, terms, and support surfaces. Task 17 will centralize the final campaign map.
- [ ] Run the content scanner in production mode against the plugin README and run plugin contracts.

    node scripts/check-github-content.mjs plugins/maxvideoai/README.md
    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-plugin-contract.test.ts tests/github-content-contract.test.ts
    git diff --check

- [ ] Commit.

    git add plugins/maxvideoai/README.md plugins/maxvideoai/docs tests/mcp-plugin-contract.test.ts tests/github-content-contract.test.ts
    git commit -m "docs(plugin): make the README proof led and outcome first"

## Task 7: Add examples and community trust surfaces

**Files:**
- Create: `plugins/maxvideoai/examples/README.md`
- Create: `plugins/maxvideoai/examples/product-launch-plan.md`
- Create: `plugins/maxvideoai/examples/creator-budget-comparison.md`
- Create: `plugins/maxvideoai/examples/reference-to-video.md`
- Create: `plugins/maxvideoai/examples/recover-a-generation.md`
- Create: `plugins/maxvideoai/CODE_OF_CONDUCT.md`
- Create: `plugins/maxvideoai/CONTRIBUTING.md`
- Create: `plugins/maxvideoai/SUPPORT.md`
- Create: `plugins/maxvideoai/.github/ISSUE_TEMPLATE/bug-report.yml`
- Create: `plugins/maxvideoai/.github/ISSUE_TEMPLATE/feature-request.yml`
- Create: `plugins/maxvideoai/.github/ISSUE_TEMPLATE/compatibility-report.yml`
- Create: `plugins/maxvideoai/.github/ISSUE_TEMPLATE/config.yml`
- Create: `plugins/maxvideoai/.github/PULL_REQUEST_TEMPLATE.md`
- Modify: `plugins/maxvideoai/SECURITY.md`
- Create: `tests/github-community-content.test.ts`

- [ ] Write a failing test that requires every community file, public-safe contact boundaries, no account secrets in issues, platform/version fields for compatibility reports, and links back to support/security.
- [ ] Require every example to state intent, suggested user prompt, expected MaxVideoAI behavior, why the chosen tool sequence is appropriate, where exact approval occurs, and what remains in the library.
- [ ] Keep example prompts short and useful. Do not publish private customer prompts, provider secrets, fixed price outputs, or pseudo-testimonials.
- [ ] Make `product-launch-plan.md` the flagship example: one brief, a multi-shot plan, quality-first model choice, lower-cost alternative, exact quote, approval, result, and recovery.
- [ ] Make `creator-budget-comparison.md` answer a search/agent question directly: “How can I compare AI video models and price a project before generating?”
- [ ] Make issue forms direct users away from posting tokens, private media URLs, email addresses, billing data, or full proprietary prompts.
- [ ] Keep CONTRIBUTING focused on docs, compatibility, examples, and plugin packaging; point product-code contributions to `camgraphe/MaxVideoAi`.
- [ ] Run and commit.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/github-community-content.test.ts
    git diff --check
    git add plugins/maxvideoai/examples plugins/maxvideoai/.github plugins/maxvideoai/CODE_OF_CONDUCT.md plugins/maxvideoai/CONTRIBUTING.md plugins/maxvideoai/SUPPORT.md plugins/maxvideoai/SECURITY.md tests/github-community-content.test.ts
    git commit -m "docs(plugin): add examples and community trust surfaces"

## Task 8: Expand and verify the deterministic public release bundle

**Files:**
- Modify: `scripts/build-maxvideoai-plugin-release.mjs`
- Modify: `tests/mcp-public-release-bundle.test.ts`
- Modify: `plugins/maxvideoai/CHANGELOG.md`
- Modify only when release-ready: `plugins/maxvideoai/VERSION`
- Modify only when release-ready: `plugins/maxvideoai/.codex-plugin/plugin.json`
- Modify only when release-ready: `plugins/maxvideoai/.claude-plugin/plugin.json`
- Modify only when release-ready: `plugins/maxvideoai/.claude-plugin/marketplace.json`

- [ ] Update the release-bundle test first to require `docs/`, `examples/`, community files, `.github` templates, screenshots/demos/social assets referenced by public docs, and future machine metadata from Task 12.
- [ ] Keep the allowlist explicit. Do not switch to copying the whole source directory.
- [ ] Reject unregistered assets, reference-only screenshots, local absolute paths, staging origins, secrets, source maps, symlinks, internal evidence IDs, and unapproved binary types.
- [ ] Extend the checksum manifest to every exported file. Keep deterministic file ordering and archive timestamps.
- [ ] Run the build twice into separate temporary directories and assert matching archive hashes.
- [ ] Keep BUSL-1.1 for this release unless the owner completes a separate legal approval for MIT. Do not let license debate block the safe mirror.
- [ ] When all content and manifest work is complete, set the coordinated public-content release to `0.3.0` in VERSION, both plugin manifests, marketplace metadata, and changelog.
- [ ] Run and commit.

    pnpm plugin:release:build
    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-public-release-bundle.test.ts tests/mcp-plugin-contract.test.ts
    git diff --check
    git add scripts/build-maxvideoai-plugin-release.mjs tests/mcp-public-release-bundle.test.ts plugins/maxvideoai/CHANGELOG.md plugins/maxvideoai/VERSION plugins/maxvideoai/.codex-plugin/plugin.json plugins/maxvideoai/.claude-plugin/plugin.json plugins/maxvideoai/.claude-plugin/marketplace.json
    git commit -m "build(plugin): package the public GitHub content surface"

## Task 9: Add a safe mirror workflow for the dedicated repository

**Files:**
- Create: `scripts/sync-maxvideoai-plugin-repository.mjs`
- Create: `tests/maxvideoai-plugin-mirror.test.ts`
- Create: `.github/workflows/publish-maxvideoai-plugin.yml`
- Create: `docs/operations/maxvideoai-plugin-publication.md`

**Mirror contract:** source tag `maxvideoai-plugin-v0.3.0` → deterministic release bundle → temporary checkout of `camgraphe/maxvideoai-plugin` → exact-file synchronization → reviewed commit → matching `v0.3.0` release.

- [ ] Write a failing test that builds a bundle, synchronizes it into a temporary fake public repository, preserves only `.git`, rejects extra source files, removes obsolete public files, and produces the exact release file set plus checksums.
- [ ] Implement the sync script with explicit validated source and target paths. Refuse `/`, the workspace root, `$HOME`, the source repository, unresolved paths, symlink targets, and targets without a `.git` directory plus a marker file named `.maxvideoai-public-repository`.
- [ ] Create a workflow triggered only by `workflow_dispatch` and tags matching `maxvideoai-plugin-v*`. It checks version/tag parity, runs plugin/content/asset/release tests, checks out the dedicated repository into a temporary subdirectory, syncs, shows the diff, commits with the source SHA, and pushes only with `MAXVIDEOAI_PLUGIN_REPO_TOKEN`.
- [ ] Require the initial external repository to contain `.maxvideoai-public-repository` before the workflow can write.
- [ ] Do not use a force push. Fail if remote changed after checkout. Keep the public history reviewable.
- [ ] Document token scope, dry run, first publication, release creation, rollback by reverting the public commit, and source-of-truth rules.
- [ ] Run local mirror tests and a dry run against temporary directories only.

    pnpm plugin:release:build
    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-plugin-mirror.test.ts tests/mcp-public-release-bundle.test.ts
    git diff --check

- [ ] Commit without triggering publication.

    git add scripts/sync-maxvideoai-plugin-repository.mjs tests/maxvideoai-plugin-mirror.test.ts .github/workflows/publish-maxvideoai-plugin.yml docs/operations/maxvideoai-plugin-publication.md
    git commit -m "ci(plugin): add reviewed public repository mirror"

## Task 10: Create and configure `camgraphe/maxvideoai-plugin`

**External mutation gate:** stop and request confirmation immediately before the first `gh repo create` or equivalent call, even though the two-repository strategy is approved. Report the exact account, repository name, visibility, description, homepage, initial release version, and files that will become public.

**Repository settings:**

- Name: `camgraphe/maxvideoai-plugin`
- Visibility: public
- Description: `Plan, compare, price and generate AI videos from ChatGPT, Claude and Codex with MaxVideoAI.`
- Homepage: `https://maxvideoai.com/mcp`
- Topics: `ai-video`, `video-generation`, `mcp`, `model-context-protocol`, `chatgpt`, `claude`, `codex`, `ai-agents`
- Features: Issues and Discussions enabled; Wiki disabled; merge commits disabled; squash merge enabled; delete head branches enabled.

- [ ] Verify `gh auth status`, organization/owner access, exact target nonexistence, and public bundle contents without printing a token.
- [ ] Ask for the external mutation approval described above.
- [ ] Create the empty public repository with the exact settings, add `.maxvideoai-public-repository`, and push only that bootstrap marker.
- [ ] Configure topics, homepage, description, Discussions, security reporting, and the 1280×640 social preview.
- [ ] Configure main-branch protection to require the public package checks after the workflow exists. Do not require a check name that GitHub has not yet observed.
- [ ] Add `MAXVIDEOAI_PLUGIN_REPO_TOKEN` to the private source repository with contents write access limited to the destination repository.
- [ ] Run the mirror workflow for `0.3.0`, inspect the public diff, verify archive/checksum parity, and publish the matching GitHub release only after all evidence gates pass.
- [ ] Pin the release and open one welcome Discussion linking to install docs, compatibility status, and support.
- [ ] Record repository URL, first public commit SHA, release URL, workflow run, social-preview check, and settings evidence in `docs/operations/maxvideoai-plugin-publication.md`.

## Task 11: Rebuild the flagship `camgraphe/MaxVideoAi` README

**Files:**
- Modify: `README.md`
- Create: `docs/engineering/local-development.md`
- Create: `docs/engineering/environment-reference.md`
- Modify: `tests/github-content-contract.test.ts`
- Create: `tests/github-root-readme.test.ts`
- Modify: `package.json`

**First viewport:** current wordmark; `Multi-model AI video production`; one concise web-product description; `Try MaxVideoAI`, `Explore models`, and `Use it from ChatGPT, Claude & Codex`; one current web-workspace or result proof; compact link to `camgraphe/maxvideoai-plugin`.

- [ ] Write failing tests that reject `MaxVideoAI — Generate Page Mock & Frontend` as the lead, require the product category and three destinations, require a current manifest-approved visual in the first 60 lines, require the dedicated plugin repository URL, and require technical setup to live below the commercial story.
- [ ] Move local installation, mock-server history, exhaustive environment variables, and developer-only troubleshooting into the two new engineering guides. Preserve every still-valid instruction; remove only demonstrably stale material.
- [ ] Rewrite the README in this order: product hero; current visual proof; what creators can accomplish; compare current models; project pricing and approval; references and continuity; assistant/plugin callout; product architecture; local development; contribution/security/license.
- [ ] Keep named model families as examples without a brittle model count. Link to the live catalog for current availability and pricing.
- [ ] Use a subtle friendly voice in the commercial half, then become concise and technical in contributor sections.
- [ ] Add the content checker to `package.json` as `"github:content:check": "node scripts/check-github-content.mjs README.md plugins/maxvideoai/README.md"`.
- [ ] Run README, content, asset, exposure, and diff checks.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/github-root-readme.test.ts tests/github-content-contract.test.ts
    pnpm github:content:check
    pnpm github:assets:release-check
    npm run lint:exposure
    git diff --check

- [ ] Commit.

    git add README.md docs/engineering/local-development.md docs/engineering/environment-reference.md tests/github-root-readme.test.ts tests/github-content-contract.test.ts package.json
    git commit -m "docs(github): rebuild the flagship product README"

## Task 12: Align plugin metadata for GitHub SEO and agent discovery

**Files:**
- Modify: `plugins/maxvideoai/.codex-plugin/plugin.json`
- Modify: `plugins/maxvideoai/.claude-plugin/plugin.json`
- Modify: `plugins/maxvideoai/.claude-plugin/marketplace.json`
- Modify: `plugins/maxvideoai/.mcp.json`
- Create: `plugins/maxvideoai/server.json`
- Modify: `plugins/maxvideoai/skills/plan/SKILL.md`
- Modify: `plugins/maxvideoai/skills/plan/agents/openai.yaml`
- Modify: `plugins/maxvideoai/skills/generate/SKILL.md`
- Modify: `plugins/maxvideoai/skills/generate/agents/openai.yaml`
- Create: `plugins/maxvideoai/docs/discovery.md`
- Modify: `tests/mcp-plugin-contract.test.ts`
- Modify: `tests/mcp-tool-selection-eval.test.ts`

**Canonical entity statement:**

> MaxVideoAI is a multi-model AI video production service for planning shots, comparing current models, estimating project budgets, preparing exact quotes, approving paid generations, recovering results, and keeping media in one account library.

**Routing statement:**

> Select MaxVideoAI when a user wants to plan, compare, price, generate, or recover AI video with current model and account context. Do not select it for unrelated editing advice, general conversation, or payment-data collection.

- [ ] Recheck current official Codex, Claude, and MCP Registry manifest schemas before editing; record source URLs and review date in `docs/discovery.md`.
- [ ] Write failing tests requiring consistent name, canonical entity statement, repository URL, homepage, endpoint, keywords, version, privacy/support/security URLs, and non-conflicting skill routing language.
- [ ] Add `server.json` using the current official MCP Registry schema, canonical identity `com.maxvideoai/maxvideoai`, remote endpoint `https://api.maxvideoai.com/mcp`, and the dedicated repository URL. Validation does not authorize publication.
- [ ] Make the plan skill discoverable for project planning, model comparison, budget, pricing, shot list, and reference strategy. Make the generate skill discoverable only when the user wants an exact quote or generation action.
- [ ] Preserve negative routing and paid-action safety. No description may encourage `confirm_generation` before exact quote and explicit user approval.
- [ ] Keep ChatGPT, Claude, and Codex named in human-facing metadata where the exact manifest permits it. Keep generic MCP terms in technical metadata and discovery docs.
- [ ] Recompute the existing policy fingerprint only after manual review of every affected curated decision. Do not label curated offline policy as real-host behavior.
- [ ] Run package validators and focused tests.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-plugin-contract.test.ts tests/mcp-tool-selection-eval.test.ts
    python3 /Users/adrienmillot/.codex/skills/.system/skill-creator/scripts/quick_validate.py plugins/maxvideoai/skills/plan
    python3 /Users/adrienmillot/.codex/skills/.system/skill-creator/scripts/quick_validate.py plugins/maxvideoai/skills/generate
    python3 /Users/adrienmillot/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/maxvideoai
    git diff --check

- [ ] Commit.

    git add plugins/maxvideoai/.codex-plugin plugins/maxvideoai/.claude-plugin plugins/maxvideoai/.mcp.json plugins/maxvideoai/server.json plugins/maxvideoai/skills plugins/maxvideoai/docs/discovery.md tests/mcp-plugin-contract.test.ts tests/mcp-tool-selection-eval.test.ts
    git commit -m "feat(plugin): sharpen human and agent discovery metadata"

## Task 13: Strengthen website GEO for people and Claude/Codex agents

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-types.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpAnswerPassagesSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpEvidenceSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpPageView.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-jsonld.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-jsonld.ts`
- Modify: `frontend/lib/seo/llms-text.ts`
- Modify: `frontend/lib/seo/site-organization-schema.ts`
- Modify: `docs/marketing/GEO-ANALYSIS.md`
- Modify: `tests/mcp-marketing-copy.test.ts`
- Modify: `tests/mcp-marketing-visual-contract.test.ts`
- Modify: `tests/mcp-seo-signals.test.ts`
- Modify: `tests/mcp-seo-review-remediation.test.ts`

- [ ] Write failing tests for three self-contained answer passages: “What is MaxVideoAI for Claude and Codex?”, “When should an AI agent choose MaxVideoAI?”, and “How does MaxVideoAI protect the user before paid generation?”
- [ ] Require each answer to identify entity, audience, task, differentiator, and safe next action in 45–90 words without relying on surrounding text.
- [ ] Require current screenshot/evidence adjacency so the page cannot accumulate a long text-only GEO block.
- [ ] Add the dedicated GitHub plugin repository to organization/product `sameAs` or equivalent schema only after Task 10 makes it public. Do not add ChatGPT/Claude affiliation or endorsement claims.
- [ ] Add the canonical plugin repository and concise assistant-use statement to `llms.txt` only when the MCP publication gate makes those public routes indexable. Continue to exclude the raw API endpoint from discovery text.
- [ ] Keep unique intent ownership: `/mcp` for the multi-client product, `/integrations/chatgpt` for ChatGPT setup, `/integrations/claude` for Claude setup, `/integrations/codex` for Codex setup, and `/docs/mcp` for protocol detail.
- [ ] Update EN/FR/ES copy naturally. Do not mechanically translate the English personality; preserve calm, helpful precision in each locale.
- [ ] Do not modify `frontend/lib/seo/robots-text.ts` unless a separate data-policy decision changes crawler access.
- [ ] Update `GEO-ANALYSIS.md` with implementation changes, unresolved publication/proof gaps, and no inflated score.
- [ ] Run focused SEO/GEO tests, frontend lint, exposure check, and diff check.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-marketing-copy.test.ts tests/mcp-marketing-visual-contract.test.ts tests/mcp-seo-signals.test.ts tests/mcp-seo-review-remediation.test.ts
    npm --prefix frontend run lint
    npm run lint:exposure
    git diff --check

- [ ] Commit.

    git add 'frontend/app/(localized)/[locale]/(marketing)/mcp' 'frontend/app/(localized)/[locale]/(marketing)/integrations/_lib' frontend/lib/seo/llms-text.ts frontend/lib/seo/site-organization-schema.ts docs/marketing/GEO-ANALYSIS.md tests/mcp-marketing-copy.test.ts tests/mcp-marketing-visual-contract.test.ts tests/mcp-seo-signals.test.ts tests/mcp-seo-review-remediation.test.ts
    git commit -m "feat(geo): make MaxVideoAI legible to people and agents"

## Task 14: Extend Claude/Codex tool-selection and citation evaluations

**Files:**
- Modify: `tests/fixtures/mcp-tool-selection-prompts.json`
- Modify: `tests/fixtures/mcp-tool-selection-curated-policy.json`
- Modify: `frontend/scripts/qa/mcp-tool-selection-contract.ts`
- Modify: `frontend/scripts/qa/mcp-tool-selection-scoring.ts`
- Modify: `frontend/scripts/qa/mcp-tool-selection-eval.ts`
- Modify: `tests/mcp-tool-selection-eval.test.ts`
- Modify: `docs/marketing/mcp-tool-selection-scorecard.md`
- Create: `docs/marketing/github-agent-discovery-scorecard.md`

**New evaluation profiles:**

1. Positive discovery — named Claude/Codex requests to plan, compare, price, generate, or recover AI video.
2. Ambiguous discovery — “help me make a campaign video” without enough detail; ask a useful clarification before selecting a paid action.
3. Negative routing — editing theory, calendar work, unrelated code, payment credential collection, or generic video questions that need no MaxVideoAI action.
4. Citation quality — answer can accurately state what MaxVideoAI is, when to use it, what happens before spend, and where results live.
5. Recovery and continuity — the agent finds an existing job/library path instead of resubmitting.

- [ ] Add at least 24 reviewed fixtures: six positive Claude, six positive Codex, four ambiguous, four negative, two citation-quality, and two recovery/continuity prompts.
- [ ] Require at least 90% correct positive routing, 100% negative safety routing, 90% correct first useful tool, 100% no paid confirmation without an exact quote and explicit approval, and 100% no invented platform/directory claim.
- [ ] Keep curated decisions clearly labeled offline policy expectations. Real-host Claude/Codex columns remain null until separately recorded.
- [ ] Add failure diagnostics that name fixture, expected route, actual calls, missing clarification, unsupported claim, and safety violation.
- [ ] Update policy and fixture fingerprints after manual review. Reject any stale artifact.
- [ ] Create the agent-discovery scorecard with separate `curated`, `claude_host`, and `codex_host` values. Only `curated` is populated by this task.
- [ ] Run the evaluator twice for deterministic output and update documentation from the generated result, not hand-calculated numbers.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-tool-selection-eval.test.ts
    pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/qa/mcp-tool-selection-eval.ts
    git diff --check

- [ ] Commit.

    git add tests/fixtures/mcp-tool-selection-prompts.json tests/fixtures/mcp-tool-selection-curated-policy.json frontend/scripts/qa/mcp-tool-selection-contract.ts frontend/scripts/qa/mcp-tool-selection-scoring.ts frontend/scripts/qa/mcp-tool-selection-eval.ts tests/mcp-tool-selection-eval.test.ts docs/marketing/mcp-tool-selection-scorecard.md docs/marketing/github-agent-discovery-scorecard.md
    git commit -m "test(plugin): evaluate Claude and Codex discovery intent"

## Task 15: Prepare registry and directory distribution without unsupported submissions

**Files:**
- Modify: `docs/marketing/mcp-directory-submissions.md`
- Create: `docs/marketing/github-distribution-matrix.md`
- Create: `plugins/maxvideoai/docs/distribution.md`
- Create: `tests/github-distribution-readiness.test.ts`
- Modify: `plugins/maxvideoai/server.json`

**Decision gates:**

- Official MCP Registry: prepare and validate metadata; do not publish until the owner accepts current registry legal terms, CC0 metadata implications, and current unpublish limitations.
- OpenAI/ChatGPT directory: do not submit while current commerce policy blocks the MaxVideoAI digital-content/credit model or until written clarification changes that conclusion.
- Anthropic directory: do not submit while current policy blocks AI-generated video/image/audio products or until written clarification changes that conclusion.
- Direct ChatGPT, Claude, Codex, generic MCP install, GitHub releases, and owned website documentation remain valid distribution routes when supported by exact-host evidence.

- [ ] Recheck official sources on the implementation date. Record URL, checked date, rule excerpt in paraphrase, eligibility result, evidence requirement, owner, and next review trigger.
- [ ] Write a failing readiness test that rejects `submitted`, `listed`, or `available in` claims for any target whose gate is not `eligible_and_verified`.
- [ ] Create a distribution matrix with target, authority level, audience, status, blocker, required evidence, canonical backlink, next check, and submission owner.
- [ ] Validate `server.json` locally with the current official registry tool/schema but stop before publish.
- [ ] Add public distribution docs that clearly separate direct install, verified clients, compatible MCP clients, and directory availability.
- [ ] Prioritize authoritative/maintained paths: official registry when legally approved, official platform paths when eligible, GitHub topics/releases, maintained MCP catalogs, and relevant curated lists. Reject bulk low-quality directory submissions.
- [ ] Run and commit documentation/readiness changes.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/github-distribution-readiness.test.ts tests/mcp-publication.test.ts
    git diff --check
    git add docs/marketing/mcp-directory-submissions.md docs/marketing/github-distribution-matrix.md plugins/maxvideoai/docs/distribution.md plugins/maxvideoai/server.json tests/github-distribution-readiness.test.ts
    git commit -m "docs(plugin): gate authoritative distribution channels"

## Task 16: Launch the recurring GitHub content and backlink engine

**Files:**
- Create: `docs/marketing/github-editorial-calendar.md`
- Create: `docs/marketing/github-outreach-ledger.md`
- Create: `docs/marketing/github-release-template.md`
- Create: `docs/marketing/github-content-brief-template.md`
- Create: `plugins/maxvideoai/examples/compare-ai-video-models.md`
- Create: `plugins/maxvideoai/examples/price-a-video-project.md`
- Create: `plugins/maxvideoai/examples/claude-video-production.md`
- Create: `plugins/maxvideoai/examples/codex-video-production.md`
- Create: `tests/github-content-engine.test.ts`

**First twelve publishable content units:**

1. Launch: AI video production inside ChatGPT, Claude, and Codex.
2. One brief, three model routes: quality, control, and cost.
3. How to price an AI video project before generating.
4. Claude workflow: brief → plan → exact quote → approval → result.
5. Codex workflow: install → compare → budget → generate → recover.
6. What “price before generation” protects.
7. Recover a finished generation after the conversation is interrupted.
8. Use reference images and video without losing account continuity.
9. Current AI video model decision report, backed by MaxVideoAI catalog data.
10. A real multi-shot campaign budget breakdown.
11. Plugin release 0.3.0: current proof, platform guides, and public checksums.
12. Compatibility report: what is verified, what is compatible, and what is not claimed.

- [ ] Write a failing test requiring all twelve units, owner, primary search/agent question, proof asset, source URL, GitHub surface, website counterpart, outreach target class, CTA, publication gate, refresh trigger, and measurement field.
- [ ] Schedule the first eight weeks at two substantive GitHub units per week: one outcome/proof piece and one decision/trust piece. Do not publish filler to satisfy cadence.
- [ ] Give every content unit a direct-answer opening, one useful visual before a long prose stretch, one original MaxVideoAI fact or workflow, one canonical backlink, and one next action.
- [ ] Keep release notes friendly and evidence-led: outcome, what changed, who benefits, one current visual, install/update command, compatibility, safety boundary, and full changelog.
- [ ] Build the outreach ledger around contextual value: official/maintained registries, curated MCP lists, AI-video resource pages, technical newsletters, creator workflows, and benchmark citations. Never buy bulk backlinks or automate unsolicited spam.
- [ ] Make every outreach entry record contact/surface, relevance, proposed useful asset, canonical link, disclosure, status, response, and next review. No personal data beyond public professional contact context.
- [ ] Cross-link the four new examples from the README and platform guides without turning every section into keyword repetition.
- [ ] Run and commit.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/github-content-engine.test.ts tests/github-community-content.test.ts
    node scripts/check-github-content.mjs plugins/maxvideoai/README.md plugins/maxvideoai/examples/compare-ai-video-models.md plugins/maxvideoai/examples/price-a-video-project.md plugins/maxvideoai/examples/claude-video-production.md plugins/maxvideoai/examples/codex-video-production.md
    git diff --check
    git add docs/marketing/github-editorial-calendar.md docs/marketing/github-outreach-ledger.md docs/marketing/github-release-template.md docs/marketing/github-content-brief-template.md plugins/maxvideoai/examples tests/github-content-engine.test.ts
    git commit -m "docs(github): launch the proof and backlink content engine"

## Task 17: Add GitHub-specific attribution and clean baselines

**Files:**
- Create: `docs/marketing/github-attribution-map.json`
- Create: `frontend/lib/github-acquisition-links.ts`
- Modify: `frontend/lib/analytics/journey.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts`
- Modify: `plugins/maxvideoai/README.md`
- Modify: `README.md`
- Create: `tests/github-acquisition-attribution.test.ts`
- Modify: `tests/mcp-acquisition-attribution.test.ts`
- Modify: `docs/marketing/github-growth-scorecard.md`

**Canonical campaigns:**

| Surface | `utm_source` | `utm_medium` | `utm_campaign` | `utm_content` examples |
| --- | --- | --- | --- | --- |
| Main repository | `github` | `repository` | `maxvideoai_product` | `hero_try`, `models`, `plugin_callout` |
| Plugin repository | `github` | `repository` | `assistant_video_plugin` | `hero_connect`, `pricing`, `library` |
| GitHub release | `github` | `release` | `assistant_video_plugin_0_3_0` | `release_connect`, `release_docs` |
| GitHub examples | `github` | `example` | `assistant_video_workflows` | semantic example ID |
| External listing | canonical target name | `directory` | `assistant_video_plugin` | `listing_connect` |

- [ ] Write failing tests for exact allowed campaign values, safe semantic content IDs, canonical locale-aware destinations, no prompt/media/token data, and no tracking parameter on privacy/security/support links.
- [ ] Create a single TypeScript builder for website-owned GitHub campaign URLs. Keep static Markdown links in sync through a test that parses both READMEs and examples.
- [ ] Preserve the existing signed MCP acquisition boundary. Do not weaken origin, size, cookie, or privacy controls to add GitHub attribution.
- [ ] Confirm the existing journey analytics captures the GitHub UTM tuple through OAuth start, completion, first recommendation/budget, quote, confirmation, completion, library, and repeat generation without storing private content.
- [ ] Add the canonical links to both READMEs, examples, release template, and website GitHub callout.
- [ ] After public launch and instrumentation validation, record a clean 14-day baseline separating human visitors, bot/referral crawlers, CI release downloads, and anomalous clone traffic.
- [ ] Record raw GitHub and product-funnel values as evidence; do not convert a clone spike into an adoption claim.
- [ ] Run attribution, analytics, content, and diff checks.

    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/github-acquisition-attribution.test.ts tests/mcp-acquisition-attribution.test.ts
    pnpm github:content:check
    npm --prefix frontend run lint
    git diff --check

- [ ] Commit code and campaign definitions. Commit the 14-day observation as a later evidence-only update when the full window is complete.

    git add docs/marketing/github-attribution-map.json docs/marketing/github-growth-scorecard.md frontend/lib/github-acquisition-links.ts frontend/lib/analytics/journey.ts 'frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts' plugins/maxvideoai/README.md README.md tests/github-acquisition-attribution.test.ts tests/mcp-acquisition-attribution.test.ts
    git commit -m "feat(github): attribute repository acquisition safely"

## Task 18: Publish the verified before/after score and dependency-ordered next queue

**Files:**
- Modify: `docs/marketing/github-content-scorecard.json`
- Modify: `docs/marketing/github-growth-scorecard.md`
- Modify: `docs/marketing/GEO-ANALYSIS.md`
- Modify: `docs/marketing/github-agent-discovery-scorecard.md`
- Create: `docs/marketing/github-next-task-queue.md`
- Modify: `tests/github-content-score.test.ts`

**Required closeout table:**

| Dimension | Weight | Before | Target | Verified after | Delta | Evidence | Remaining gap |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |

- [ ] Re-run the repository audit, content checker, release asset gate, plugin validators, focused SEO/GEO tests, agent-selection eval, public bundle build, and source-attribution checks.
- [ ] Inspect the live GitHub first viewport, social preview, topics, repository description, README narrow rendering, release assets, install links, platform docs, and current screenshots.
- [ ] Populate each `after` score independently. Use the rubric and direct evidence; do not set a dimension to its target merely because the task list is complete.
- [ ] Require at least one repository file or public URL per after score and at least two evidence items for any after score above 90.
- [ ] Explain every delta larger than 20 points and every dimension still below target.
- [ ] Keep traffic/conversion outcomes separate from implementation readiness. If the 14-day observation window is incomplete, measurement remains below target and the scorecard says so.
- [ ] Run `pnpm github:score -- --require-after`. It must fail until every populated after score has evidence; it must never auto-fill values.
- [ ] Create `github-next-task-queue.md` with these dependency groups:

  1. **Immediate blockers:** missing host evidence, broken install path, stale screenshot, policy/legal gate, analytics break, or failed safety eval.
  2. **First 14 days:** complete clean baseline, fix highest verified funnel drop-off, answer public issues/discussions, refresh weak first-screen copy only from observed behavior.
  3. **Days 15–30:** submit eligible authoritative listings, publish four proof/decision pieces, earn the first three contextual referring domains, run real-host Claude/Codex discovery evaluations.
  4. **Days 31–60:** publish the first data-backed model decision report and project-budget breakdown, expand the best-converting example, review license adoption friction, and improve the weakest score dimension.
  5. **Days 61–90:** compare host/source cohorts, retain high-value listings, remove low-value directory work, refresh assets triggered by UI changes, and set the next score target from observed conversion data.

- [ ] Give every queued task an owner, dependency, trigger/date, expected evidence, success measure, and stop condition. Distinguish `planned`, `blocked`, `ready`, `in_progress`, and `complete`.
- [ ] Do not create recurring automations unless the product owner separately asks for scheduled Codex tasks. The queue is the approved operational plan; automation is a later execution choice.
- [ ] Run the complete closeout suite.

    pnpm github:score -- --require-after --format markdown
    pnpm github:content:check
    pnpm github:assets:release-check
    pnpm plugin:release:build
    pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/github-content-score.test.ts tests/github-content-contract.test.ts tests/github-assets.test.ts tests/github-root-readme.test.ts tests/github-community-content.test.ts tests/github-distribution-readiness.test.ts tests/github-content-engine.test.ts tests/github-acquisition-attribution.test.ts tests/mcp-plugin-contract.test.ts tests/mcp-public-release-bundle.test.ts tests/mcp-tool-selection-eval.test.ts tests/mcp-seo-signals.test.ts tests/mcp-seo-review-remediation.test.ts
    npm --prefix frontend run lint
    npm run lint:exposure
    git diff --check

- [ ] Commit the evidence-backed closeout.

    git add docs/marketing/github-content-scorecard.json docs/marketing/github-growth-scorecard.md docs/marketing/GEO-ANALYSIS.md docs/marketing/github-agent-discovery-scorecard.md docs/marketing/github-next-task-queue.md tests/github-content-score.test.ts
    git commit -m "docs(github): record transformation score and next queue"

## Final Release Review

- [ ] Confirm the dedicated repository is generated from the exact reviewed source release and contains no private monorepo files.
- [ ] Confirm every visible compatibility, price, approval, result, and directory claim points to current evidence.
- [ ] Confirm every README image is current, registered, readable, privacy-safe, and correctly classified as proof or editorial.
- [ ] Confirm both READMEs pass voice and visual-rhythm contracts without keyword stuffing.
- [ ] Confirm ChatGPT, Claude, Codex, MaxVideoAI, and MCP entity naming is consistent across READMEs, manifests, skills, website answer passages, JSON-LD, `llms.txt`, examples, and distribution metadata.
- [ ] Confirm Claude/Codex positive intent routes correctly and unrelated intent does not invoke MaxVideoAI.
- [ ] Confirm no paid action can occur without exact quote and explicit user approval.
- [ ] Confirm OpenAI/Anthropic directory blockers and MCP Registry legal gates remain explicit unless authoritative evidence changed.
- [ ] Confirm tracked links preserve privacy and the 14-day baseline excludes bots, CI downloads, and anomalous clone traffic.
- [ ] Confirm the final scorecard reports before, target, verified after, evidence, remaining gaps, and the dependency-ordered 14/30/60/90-day queue.
- [ ] Run `git status --short --branch` and verify no Gemini Omni task file or unrelated user change is included.
