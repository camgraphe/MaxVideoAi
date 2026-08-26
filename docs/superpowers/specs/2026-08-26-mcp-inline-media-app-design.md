# MaxVideoAI MCP inline media app design

## Outcome

When a connected assistant has recovered a completed MaxVideoAI generation, it can call one read-only presentation tool that renders the owned result directly inside a compatible ChatGPT or Claude conversation. Video uses a native, controlled, inline player. Image output uses the same card shell. Hosts without MCP Apps support retain the existing text, resource-link, and MaxVideoAI library fallback.

## Product boundary

The assistant remains the creative interface. The inline app does not add prompt fields, model selectors, budgets, confirmation controls, or generation actions. It presents an already-authoritative generation result once, after the assistant has used the existing status or recovery tools.

The primary proof for marketing is one real host screenshot containing the conversation and the playable result. Mocked host screenshots must not be published as compatibility evidence.

## Interaction

1. The assistant recovers or polls a generation with `get_generation_status` or `list_recent_generations`.
2. After a completed result is known, the assistant calls `present_generation` with the owned `jobId`.
3. A compatible host renders `ui://maxvideoai/generation-result-v1.html` inline.
4. The card shows the media, completed state, exact charged price when available, and a first-party MaxVideoAI destination.
5. The user can play the video in place or open the result in MaxVideoAI.

## Architecture

- Keep status and recovery as reusable data tools.
- Add one read-only render tool, `present_generation`, backed by the same ownership-checked `getGenerationStatus` service.
- Register one MCP Apps HTML resource with `text/html;profile=mcp-app`.
- Use `structuredContent` as the authoritative widget input and preserve existing `resource_link` content for non-UI hosts.
- Use `_meta.ui.resourceUri` as the portable contract and the OpenAI output-template alias for compatibility.
- Allow media only from the same stable first-party/configured origins already accepted by the generation recovery policy.
- Use `ui/open-link` for portable first-party navigation and feature-detect `window.openai.openExternal` as a ChatGPT compatibility path.

## Visual target

The selected target is the third generated design direction:

`/Users/adrienmillot/.codex/generated_images/019f510a-3ce2-72c2-8836-ed267d24d5ec/exec-be36ca23-a3a9-461a-bd1c-f4b32dee5f01.png`

Only the inline result card is implemented in the MCP App. It uses MaxVideoAI's light-first visual language, supports dark host themes, keeps the 16:9 media dominant, and avoids nested dashboards or technical MCP language.

## Safety and claims

- The tool remains OAuth-scoped and can present only an owned job.
- It never starts, retries, confirms, or charges a generation.
- It never exposes provider credentials, prompts, private source references, wallet details, or storage internals.
- Marketing may say that inline playback is supported only after it is exercised on the exact named host version.
- Until then, public copy may describe the feature as being tested, while the existing library link remains the universal fallback.

