# Milo launch readiness and positioning — 2026-10-29

This is a bounded launch audit and proposed marketing plan for PR #555. It is not a production release or a claim of measured customer savings. Public-page observations describe the pages retrieved on this date. Code observations start from `e865d1ba8`; the customer-copy corrections in this increment are described separately.

## Product identity and promise

Present **Milo as MaxVideoAI's creative AI assistant**. Public modes are **Milo Lite, Milo Standard, Milo Max**. Describe their uses and credit consumption. Do not foreground underlying language-model brands, version numbers or reasoning settings in the picker or marketing; these are operational details that may change. This does not imply that MaxVideoAI trained the underlying foundation models. Keep actual provider/runtime/tariff facts in engineering records and the authorized admin review.

Proposed English copy:

> **Your idea. Milo helps write the prompt.**
>
> Describe what you want to create. Milo helps shape a prompt for your selected model, using your references and current settings. Refine it together, review the prompt, then choose when to generate.

Supporting line:

> Prepare your next generation with more context.

Do not promise a perfect prompt, guaranteed fidelity, fewer attempts in every case or a percentage saving. Better preparation is the intended mechanism; actual savings need measurement. Assistance and analysis also have costs. A longer prompt is not automatically a better prompt.

## What is implemented and what remains before release

- The compact manual/assistant workspace, shared levels/credits, model-specific guides, current settings/reference context and explicit Apply flow are implemented.
- Real isolated checks cover consecutive exchanges, long-draft preservation, credit debits/replay, images across all levels, and bounded video/audio analysis for Standard/Max. These are functional samples, not a broad quality benchmark.
- Current PR #555 is draft and unmerged. At the audited head, Vercel deployment and preview-feedback checks are successful, but there is **no successful required Quality CI attached to that head**. No submitted GitHub review was returned.
- After fetching main, the branch lacks **19 main commits**. A merge-tree diagnostic finds **three conflicted files**: workspace composer orchestration, Studio director instructions, and its test. No working-tree merge was performed. Reconcile both sets of changes and rerun the required checks on the resulting candidate; an older green run does not qualify it.
- Migrations **85–89** were exercised on an isolated Neon copy, not the parent production database. **90** is needed for the new admin review/capture. Apply only pending migrations, with documented prerequisites and forward-compatible recovery.
- Activate the live composer/public build flags, optional perception flags and approved analysis policies together with their schemas. Verify the shared worker/cron and the intended deployment's credentials; local API success is not proof of production configuration. Keep recovery/status paths available for already paid work during rollback.
- Before activation, exercise one complete production-like path for each surface, guest/account entry, included-credit exhaustion, purchased-use pause, fallback to Lite, lost response/reload, references and mobile input. Retain provider-specific source restrictions and Draft behavior.
- Set the retention/deletion and customer-information policy for newly retained conversation context and admin access. The implementation audits reveal access, but does not choose that policy or create an automatic retention job.
- Some new service feedback remains English. The user chose English for design work; FR/ES completeness is an explicit rollout scope decision.
- Update the PR description with the final source-flow fixes and branding changes when preparing release review.

Internal evidence: [live qualification](../engineering/milo-live-check-2026-10-29.md), [perception](../engineering/prompt-assistance-reference-perception.md), [levels and migrations](../engineering/milo-levels.md), [credit recovery](../engineering/milo-credit-recovery.md), [admin review](../engineering/assistant-review.md), [earlier test limitations](../engineering/prompt-assistance-validation.md).

## Customer explanation to finish

Keep these three entry points distinct:

| Entry | Customer job | Next explicit action |
| --- | --- | --- |
| Milo in Video / Image / Audio | Prepare or refine the current generator's prompt with current context | Use prompt, then Generate at the displayed media price |
| Studio | Develop a creative project through conversation and supported tools | Review and approve a prepared media quote |
| MCP | Use MaxVideoAI from a compatible external assistant | Follow that host's setup and explicit quote approval |

Do not present MCP as another Milo plan. Do not claim access to the external host's full conversation. A generic instruction to Milo does not itself change generator settings or launch media.

Mode explanation should answer use and cost first:

- Lite: everyday ideas and prompt edits; no customer assistance-credit debit, with account/request/service limits. Can inspect supported image content.
- Standard: creative work and planning; shares included and purchased credits with Max.
- Max: more demanding direction and detailed briefs; uses the same balance with different consumption.
- Video/audio inspection for Standard/Max is a separate, explicitly confirmed analysis of an excerpt. Current bounded coverage is not complete viewing/listening; attachment alone is not proof it was analyzed.

Explain 500 shared included monthly credits, renewal/no rollover, cumulative purchased credits and explicit purchases in the credits help. Do not promise a fixed number of messages. When funding is insufficient, explain the offered Send with Lite / Add credits choices without losing the draft.

## Public content gaps observed and corrections in this increment

| Surface | Observation | Consequence / action |
| --- | --- | --- |
| [/studio](https://maxvideoai.com/studio) | Public FAQ still describes the old free Standard tier and names backend models | Correct to Lite, shared Standard/Max credits and Milo branding; included in this increment, not yet deployed |
| [/pricing](https://maxvideoai.com/pricing) and PAYG content | Same old two-tier wording and Max-only packs | Align EN/FR/ES with the shared offer; included in this increment, coordinated with release |
| Shared mode/credits panel | Internal model name and high/xhigh reasoning are displayed | Removed from the customer panel; retain actual costs and consumption explanations |
| [Homepage](https://maxvideoai.com/) and [getting started](https://maxvideoai.com/docs/get-started) | Main entry describes choosing a model and creating; no dedicated explanation of the new in-generator conversation | Add a compact benefit block and one short real walkthrough after UI freeze |
| Launch proof | Existing technical checks and mock/example visuals do not demonstrate customer savings | Produce a synthetic/public-reference demo with brief → conversation → applied prompt → quote → result; label real billed figures as that example only |
| Measurement | Admin evidence exists; composer Apply/Undo/Generate attribution and customer ratings are explicitly deferred | Connect these events without raw chat text in acquisition analytics; collect user judgment before calling a result useful |

The marketing copy needs to ship with the corresponding enabled product. This audit did not publish content or change production flags.

## Competitor messaging: observed, not an efficacy comparison

- [Runway Enhance Prompt](https://help.runwayml.com/hc/en-us/articles/50012632982163-Enhancing-your-Prompts) sells rewriting a simple input with generation-specific detail, then reviewing it. Its [Agent guide](https://help.runwayml.com/hc/en-us/articles/51601639579667-Creating-with-Runway-Agent) leads from a plain-language request into planning and creation.
- [Higgsfield Genjutsu](https://higgsfield.ai/creator-hub/help-center/tools/how-do-i-use-genjutsu) lowers input effort with motion presets/reference-led editing; a written prompt can be optional. It is a different workflow from a prompt conversation.
- [Krea Agent](https://www.krea.ai/agent) presents concrete creative tasks and reusable templates. This supports starting from a customer's intended result rather than internal model terminology.
- [DreamBench's Seedance prompt page](https://dreambench.ai/tools/seedance-prompt-generator) and [Seed Video's tool](https://seed-video.com/tools/seedance-prompt-generator/) show that model-specific prompt generators already exist. This category is not an exclusive differentiator.

The defensible positioning is the **combination** of in-place conversation, actual generator context, optional reference inspection, explicit prompt review and visible generation price. Do not claim competitors lack each ingredient. No competitor product was benchmarked or purchased.

## SEO and AI-search proposal

Start with **one useful public landing page**, proposed `/ai-video-prompt-generator`, with Milo as the product identity and descriptive search language in title/intro. Candidate title: **AI Video Prompt Generator & Assistant | Milo by MaxVideoAI**. The page is a proposal, not created or indexed by this work.

Use existing Studio and model pages rather than creating a duplicate thin page for every model:

1. Primary intent: `AI video prompt generator`, `video prompt assistant`, `improve AI video prompts`.
2. Model-specific sections on existing model pages: `Seedance prompt generator`, `Kling prompt guide`, `Veo prompt examples`, each with verified model-specific examples and a direct generator entry.
3. Practical guide: adapting one idea to different models, durations and reference roles, with a before/after brief and actual result. Explain what changed and why, including limits.
4. Add visible links from homepage, Studio, model guides, getting started and pricing. Preserve existing localized canonical/hreflang contracts.
5. Publish readable factual answers: what Milo does, where it works, account requirement, free vs credit modes, references/coverage, manual control and separate media costs. Keep structured data consistent with visible content.

These are intent candidates, **not a volume-ranked keyword plan**. A Semrush US batch request for eight relevant terms returned `API UNITS BALANCE IS ZERO`; no volume or difficulty data was obtained. Search results demonstrate existing competing pages, not demand size, rank opportunity or likely conversion.

For Google AI Overviews/AI Mode, [Google's own guidance](https://developers.google.com/search/docs/appearance/ai-features) says ordinary SEO fundamentals apply and no special AI-specific optimization is required. This supports useful crawlable explanations and consistent product facts; it does not promise AI citations. Do not use foundation-model brand names as the SEO proposition.

## Release order

1. Reconcile current main, preserve source-flow/billing changes, qualify required CI and review.
2. Prepare the explicit database/config/worker rollout and rollback/recovery procedure; settle retention and locale scope.
3. Finish a compact first-use explanation, the public Milo page/help and one truthful end-to-end demo. Publish with activation.
4. Measure first message → useful proposal → Apply → approved generation → customer-assessed usable result. Separate assistance/analysis spend from media spend; exclude admin/QA.
5. Expand model-specific guides and compare outcomes only with controlled briefs or a credible experimental design. A download, successful job or longer prompt alone does not prove saved money.

No merge, production deployment, migration, purchase, paid provider call or outbound announcement was performed for this audit.

Customer-copy validation: 112 focused checks passed (shared credits/legacy dialog, Studio public copy and the PAYG suite), including the existing purchase/revision/focus checks and localized canonical/FAQ consistency. TypeScript and public-exposure checks passed. Frontend lint reported zero errors and seven existing warnings. This is incremental validation; final required Quality CI and release qualification remain outstanding. The initial wording assertion also matched the legitimate external ChatGPT link; it was narrowed to actual backend model names/IDs before the successful rerun.

