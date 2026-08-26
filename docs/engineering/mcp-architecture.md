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

One hosted OAuth-protected MCP server serves every client. Client-specific plugin or skill packages add installation instructions and workflow guidance; they must not fork business logic or the model catalogue.

## Source-of-truth rule

`frontend/config/model-registry.json` is the only authored source for model identity, aliases, family, publication, replacement, and route tombstones. Never copy a model catalogue into the MCP skill, its marketing pages, or a client package.

The MCP tools `list_models` and `get_model_details` read the same live registry, runtime capabilities, and pricing services used by MaxVideoAI. A connected assistant must call them instead of relying on model memory. Project budgets and generation quotes therefore use current executable modes and current prices.

Marketing copy may name strategic models as examples, but model counts, capabilities, exact prices, and rankings must come from the live services. Do not hard-code those facts into prose or UI cards.

## Adding or changing a model

Follow `docs/engineering/model-registry.md` for every addition, rename, retirement, publication change, or alias change.

1. Author the model and execution definition through the standard registry workflow.
2. Add or update provider mode capabilities, pricing inputs, and reference constraints.
3. Regenerate the registry projections with the documented commands.
4. Run `pnpm model:registry:check` and the focused provider, pricing, registry, and MCP capability tests.
5. Exercise `list_models`, `get_model_details`, project budgeting, and quote preparation against the updated model before publication.

Because clients discover capabilities through the hosted server, a valid catalogue update becomes available to ChatGPT, Claude, and Codex without editing or redistributing their plugin guidance. Update the skill only when the workflow itself changes, not when a routine model or price is added.

## Provider and mode support

Expose only modes backed by the same executable path as the MaxVideoAI website. A provider-specific credential or unavailable transport must disable only its dependent mode; it must not hide supported modes from the same model.

Seedance 2.5 currently uses the working ModelArk path for text-to-video, image-to-video, reference-to-video, and extension. Direct video-to-video that depends on BytePlus LAS remains unavailable until LAS access exists. The tool response must state that precise mode-level limitation without weakening the supported modes.

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
