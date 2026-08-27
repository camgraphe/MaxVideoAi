# MaxVideoAI conversational plugin architecture

This guide is the operating reference for the MaxVideoAI AI video plugin, its remote MCP server, and its ChatGPT, Claude, and Codex installation surfaces.

## Product boundary

The public product is an **AI video plugin for ChatGPT**, a **MaxVideoAI connector for Claude**, and a technical **Codex plugin** for creator workflows. MCP is the shared transport, not the lead marketing promise.

The assistant owns the conversation and creative reasoning. MaxVideoAI supplies the facts and actions that change over time:

- account, balance, credits, top-up, and library continuity;
- current executable models, modes, capabilities, limitations, and pricing;
- project budgets and exact expiring generation quotes;
- validation of image, video, and audio references;
- explicit approval, job creation, polling, recovery, and refund state.

The only custom chat UI is a decoupled result presenter for an already completed owned generation. `present_generation` renders a native video player or image card in MCP Apps-compatible hosts. It never owns creative input, model choice, pricing, approval, generation, polling, or retries. Existing text, resource links, and MaxVideoAI library destinations remain the universal fallback.

The current presenter template uses `ui://maxvideoai/generation-result-v4.html`. Because hosts and existing conversations may cache a tool descriptor, the server must keep every previously published presenter URI readable; `v1`, `v2`, and `v3` are compatibility resources, not the current template. A widget change publishes a new URI instead of replacing the bytes behind the current cache key.

Generated media is durable in the connected MaxVideoAI account. Direct S3 attachment URLs remain short-lived credentials. The result widget calls the app-only, read-only `get_generation_download` tool when the user clicks **Download**, revalidates ownership, and creates a fresh attachment URL at that moment. It then hands that vetted attachment URL to the host through `window.openai.openExternal`, with the portable MCP Apps `ui/open-link` request as fallback. The host opens the response outside the sandbox, where its `Content-Disposition: attachment` header can start the browser download. Exact configured media origins belong in the OpenAI redirect allowlist; never use wildcards. Do not solve return visits by publishing a multi-day storage credential: preserve the job/library destination and refresh the download on demand.

One hosted OAuth-protected MCP server serves every client. Client-specific plugin or skill packages add installation instructions and workflow guidance; they must not fork business logic or the model catalogue.

## Source-of-truth rule

`frontend/config/model-registry.json` is the only authored source for model identity, aliases, family, publication, replacement, and route tombstones. Never copy a model catalogue into the MCP skill, its marketing pages, or a client package.

The MCP tools `list_models` and `get_model_details` read the same live registry, runtime capabilities, and pricing services used by MaxVideoAI. A connected assistant must call them instead of relying on model memory. Project budgets and generation quotes therefore use current executable modes and current prices.

Reviewed manufacturer prompting references are authored separately in `frontend/config/agent-model-prompting-sources.json`. `get_model_details` projects at most three matching `promptingSources` and removes modes the public model does not expose. Every entry must use an allowlisted official HTTPS host, name explicit model IDs and canonical modes, and carry a review date. These links inform prompt craft only: the live MaxVideoAI model details remain authoritative for availability, settings, pricing, references, and execution. Do not add a guessed provider URL when no reviewed source exists.

Marketing copy may name strategic models as examples, but model counts, capabilities, exact prices, and rankings must come from the live services. Do not hard-code those facts into prose or UI cards.

## Adding or changing a model

Follow `docs/engineering/model-registry.md` for every addition, rename, retirement, publication change, or alias change.

1. Author the model and execution definition through the standard registry workflow.
2. Add or update provider mode capabilities, pricing inputs, and reference constraints.
3. Regenerate the registry projections with the documented commands.
4. Run `pnpm model:registry:check` and the focused provider, pricing, registry, and MCP capability tests.
5. Exercise `list_models`, `get_model_details`, project budgeting, and quote preparation against the updated model before publication.

When a model receives an official prompting source, update the separate source registry and run `tests/mcp-model-prompting-sources.test.ts`. Do not put external provider links in `agent-model-guidance.json`; its evidence URLs remain first-party MaxVideoAI evidence.

Because clients discover capabilities through the hosted server, a valid catalogue update becomes available to ChatGPT, Claude, and Codex without editing or redistributing their plugin guidance. Update the skill only when the workflow itself changes, not when a routine model or price is added.

## Provider and mode support

Expose only modes backed by the same executable path as the MaxVideoAI website. A provider-specific credential or unavailable transport must disable only its dependent mode; it must not hide supported modes from the same model.

Seedance 2.5 currently uses the working ModelArk path for text-to-video, image-to-video, reference-to-video, and extension. Direct video-to-video is represented by the canonical contract but remains unavailable in environments without BytePlus LAS access. The tool response must state that precise mode-level limitation without weakening the supported modes.

Specialized website workflows are part of the same rule: LTX audio-to-video and retake, Luma reframe, and the lower-cost Kling 2.5 Standard image-to-video tier are exposed only through canonical names and verified MaxVideoAI media. Gemini Omni retake stays closed until an owned source job can be translated server-side to its private provider interaction identifier.

For every model, verify:

- text, image, video, and audio input roles by mode;
- number, ordering, size, duration, and MIME constraints for references;
- duration, aspect ratio, resolution, audio, and seed support;
- price calculation and any provider retry/refund behavior;
- website and MCP parity for storage and gallery recovery.

## Account and media continuity

OAuth always links an existing MaxVideoAI user. MCP generation uses that user's wallet and the same media persistence pipeline as the website. References selected from the account and completed outputs remain visible in the private MaxVideoAI library.

When balance is insufficient, the assistant should:

1. explain the amount missing;
2. open an official MaxVideoAI top-up handoff;
3. let payment remain entirely on MaxVideoAI;
4. re-read the wallet after the user returns;
5. prepare a fresh quote because the earlier quote may have expired.

Never describe staging balance as a separate customer wallet. Staging uses test infrastructure; production users retain one MaxVideoAI account experience across the website and connected assistants.

## Generation safety and recovery

Browsing models, asking for recommendations, and building budgets are free read-only operations. A paid generation requires this sequence:

1. validate model, mode, prompt, settings, and ordered references;
2. return an exact, short-lived quote;
3. obtain explicit user approval for that quote;
4. create exactly one job using the idempotency contract;
5. poll or recover the existing job rather than creating a duplicate;
6. expose the saved media or the final failure/refund state;
7. optionally call `present_generation` once to render the completed result inline in a compatible host.

Creative retries are new paid attempts and require a new quote and approval. Provider failures follow the existing MaxVideoAI refund contract.

New prepared generation quotes use a server-owned 45-minute confirmation window. Clients cannot choose or extend that lifetime. Migration 39 keeps the historical 10-minute shape readable and database-valid without rewriting immutable quotes created before the change; all newly prepared quotes use 45 minutes.

The MCP HTTP route reserves the idempotent job before contacting a provider and allows up to 120 seconds for provider acceptance. If a client connection still ends ambiguously, recover that same job with `get_generation_status`; never resubmit the confirmed quote as a creative retry.

## Public surfaces and maintenance

- `/mcp`: commercial product and acquisition hub.
- `/integrations/chatgpt`: ChatGPT installation and workflow intent.
- `/integrations/claude`: Claude connector installation and workflow intent.
- `/integrations/codex`: Codex technical installation and workflow intent.
- `/docs/mcp`: protocol, OAuth, tool, recovery, credit, reference, and library reference.
- `plugins/maxvideoai`: distributable plugin/skill package and repository-facing documentation.

Publication is controlled by `frontend/config/mcp-publication.json`. Keep marketing rendering, indexing, connection, paid generation, introductory promotion, and reference claims independently gated. The optional introductory credit must never block indexation of an otherwise launch-ready product.

Before changing a public claim, update the corresponding automated contract and hosted evidence. Keep client version evidence exact and dated. Do not turn an untested client into a generic disclaimer across clients already verified.

## Verification checklist

Run the narrowest affected checks first, then the complete MCP contract suite:

```bash
pnpm model:registry:check
frontend/node_modules/.bin/tsc -p frontend/tsconfig.json --noEmit
npm run lint:exposure
git diff --check
```

For a launch candidate, also verify in each supported client: OAuth, account summary, model discovery, model details, project budget, exact quote, explicit approval, media references, job recovery, top-up handoff, and library continuity. A real paid generation should be deliberately small and may double as honest marketing proof only when its provenance is recorded.
