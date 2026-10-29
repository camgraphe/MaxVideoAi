# Milo composer: LLM integration practices

Reviewed 2026-10-29 for draft PR #555. This is an implementation audit, not a provider-quality certification. Sources are official documentation and the official SDK repository; no external implementation was copied.

## Decisions supported by the documentation

| Practice | Implementation in this increment | Evidence / limitation |
| --- | --- | --- |
| Separate application instructions from customer data | Static instructions; draft, scalar settings, reference metadata, message and history use user/assistant messages. Capabilities and fiches come from the server. | [OpenAI agent safety guidance](https://developers.openai.com/api/docs/guides/agent-builder-safety). Separation reduces injection risk; it does not make model text trustworthy. |
| Validate generated data, including exceptional responses | Strict reply/nullable text schema, then application validation and selected-model character limit. Refused, incomplete, malformed and oversized proposals cannot be applied. | [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). A strict schema does not guarantee a usable suggestion in every response. |
| Avoid hidden paid retries | Responses uses `maxRetries: 0` and a 65-second timeout. Account/request identities, saved evidence and recovery are application-owned. | The [official Node SDK](https://github.com/openai/openai-node/blob/main/README.md#retries) retries some errors, including timeouts, by default. Disabling retries does not establish exactly-once execution at the provider. |
| Treat timeout as uncertainty | Stop waiting only stops the browser wait; an unknown dispatched outcome retains its reservation. Check reply cannot call the model. Support cannot waive an active lease. | SDK timeout/cancellation behavior plus our financial invariants. Concurrency, late evidence and recovery tests use the actual ledger with a disposable database. |
| Preserve usage when output is unusable | Save provider evidence before parsing, settle known usage once, then validate the proposal. | [Reasoning token limits](https://developers.openai.com/api/docs/guides/reasoning/advice-on-prompting). A refusal or token-limit response may still consume tokens. Our 2,200-token output budget includes reasoning and needs evaluation against long prompts. |
| Limit authority and supplied data | No tools, arbitrary URL retrieval, media generation, setting edits or purchases in the model contract. References are owned and server-resolved. Optional image perception supplies transient normalized pixels; confirmed bounded video/audio analysis supplies validated observations. No private URLs or filenames are sent as context. | Safety guidance above. Apply requires the current draft revision. Only an explicit per-reference perception record permits content claims; uninspected media stays metadata-only. |
| Evaluate the real task and its failures | Offline fixtures cover ownership, replay, recovery, credits, draft revisions and exceptional output. Writing quality requires a separate evaluation. | [Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices). Deterministic fixtures do not demonstrate good creative suggestions. |

The existing Responses/ledger path fits this bounded text-assistance task. No Agents SDK, MCP tool loop or multi-agent runtime is needed here. This is a task-specific choice, not a conclusion about Studio. The reviewed docs also contain Agent Builder and hosted Evals lifecycle notices; those hosted products are not introduced as dependencies.

`store: false` is set on Responses calls. It is not a zero-retention guarantee: this application persists request/evidence data, and provider retention depends on the account's terms and configuration. Do not log keys, private media URLs or raw prompts to general-purpose application logs. Define retention/deletion before extending durable user-visible chat history.

## Quality and cost evaluation before activation

Use a versioned case set reviewed by a human. Keep held-out cases when refining fiches. Record the selected model, operation, guide version, assistant tier, token usage, elapsed time and failure category. Use synthetic or sanitized examples, not copied customer conversations without an appropriate basis.

| Case family | Assessment |
| --- | --- |
| Video Create / Modify / Extend across supported families | Action, motion, camera, continuity, supported mention syntax; no invented capability or automatic setting change. |
| Image generation and editing | Subject, composition, preservation constraints and reference roles; no invented visual perception. |
| Voice, instrumental, song style, effects, ambience | Correct writable field; spoken script for voice; lyrics remain separate; instructions suit audio. |
| Vague brief / detailed long draft | A focused question only when needed; preservation of substantive details; complete proposal within output limits. |
| Model/reference/settings changes during a reply | Old suggestion can be reviewed but cannot overwrite the newer draft. |
| Hostile instructions in draft/history/reference descriptions | No authority escalation, disclosure of other users' data, tool use, invented billing or fabricated actions. |
| Unrelated requests / legitimate media content about the same topic | Recipe alone redirects without a proposal; a cooking-video prompt or voice script remains valid. Studio must not execute tools for the unrelated task. |
| Instruction text inside a supplied image / transcript / analysis | Use the media as reference content; never treat its embedded instructions as a role or scope change. |
| Refusal, token exhaustion, malformed output, transport loss | Clear outcome, no partial Apply, no automatic retry, consistent evidence and credits. |

Compare Standard and Max on the same cases with human ratings for usefulness, faithfulness, capability accuracy and reference handling. Measure median/tail latency, input/output/reasoning tokens, unusable-response rate and cost per usable suggestion. Define release thresholds before the paid evaluation, using this task rather than unrelated benchmarks. Terra/Lite are separate candidates, not silent replacements for existing tiers.

## Useful later work for Studio

- Reuse versioned guidance and evaluation cases with Studio's own capability and authorization owners.
- Apply the same provider-exception taxonomy and duplicate-call checks where relevant. This audit does not certify every existing Studio path.
- The separately flagged owned-reference perception path is documented in [reference perception](prompt-assistance-reference-perception.md), including explicit analysis costs, bounded coverage, privacy and real qualification. Never present metadata-derived descriptions as perception.
- Add human feedback and sanitized failure cases to evaluations. If later work introduces tools, assess tool decisions separately from writing quality.

No live supplier calls, shared migrations or paid evaluation were performed for this review.
