# MaxVideoAI for ChatGPT, Codex and MCP

Animate a product photo, generate a video from a brief or compare two models for the same shot. Use the official MaxVideoAI plugin in ChatGPT, install the Codex package or connect Claude through the Model Context Protocol (MCP). Your finished media goes to the Library of the MaxVideoAI account you connect.

**[Install MaxVideoAI in ChatGPT](https://chatgpt.com/plugins/plugin_asdk_app_6af7c45d28c48191982cf5be6eb7e058)** · [Set up MaxVideoAI in Codex](#install-in-codex) · [Connect Claude via MCP](docs/claude.md)

<img src="assets/campaign/paper-run.webp" width="100%" data-asset-role="editorial" alt="Editorial illustration: a crouching skateboarder rolls right beneath a bridge as orange, pink and blue paper unfolds behind him">

*Paper Run.* Original editorial illustration created with ImageGen for this brief. [See the shot list and three dated MaxVideoAI price estimates](examples/codex-video-production.md#what-did-a-five-second-take-cost-to-plan)

## Direct Paper Run

<a id="try-asking" name="try-asking"></a>

The rider rolls right. The paper follows a beat later. Use the delay to connect three shots in the same night scene. Try this in the connected assistant.

```text
Plan a six-second skate sequence from this opening frame. Track beside the
front wheel as the rider rolls right under the bridge. A ripple travels
back along the paper ribbon and opens three accordion folds in sequence.
Cut to the ground as their shadows cross a seam in the concrete. On the
third shadow, cut wide and let the last fold settle behind the rider.

Keep both shoes planted, the wheels on the ground and the streetlight on
the same side of the deck. Compare two image-to-video models for the
unfolding shot at matching settings. Show supported durations, reference
requirements and estimated costs. Wait for my choice before quoting.
```

The six seconds describe the intended edit. Each model has its own shot lengths and reference inputs. [Read the shot list and adapt the brief](examples/codex-video-production.md) · [Explore the MaxVideoAI integrations](https://maxvideoai.com/mcp?utm_source=github&utm_medium=repository&utm_campaign=assistant_video_plugin&utm_content=hero_connect)

## Connect in ChatGPT

Install the MaxVideoAI plugin from the ChatGPT directory and connect your MaxVideoAI account. Select **Install plugin** on the official listing and sign in to the account whose credits and Library you want to use. [Open the ChatGPT listing](https://chatgpt.com/plugins/plugin_asdk_app_6af7c45d28c48191982cf5be6eb7e058) · [ChatGPT setup and first request](docs/chatgpt.md)

## Install in Codex

<a id="install-the-repository-validated-codex-package" name="install-the-repository-validated-codex-package"></a>

Run these commands in a Codex build with plugin marketplace support. They install the public v0.3.8 package. [Tagged Codex release](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.8)

```sh
codex plugin marketplace add camgraphe/maxvideoai-plugin --ref v0.3.8
codex plugin add maxvideoai@maxvideoai
```

Open a new task and connect your MaxVideoAI account. Use `$maxvideoai:plan` to compare routes. When you choose the shot, `$maxvideoai:generate` can prepare its exact quote. [Codex setup and local reference files](docs/codex.md)

## What does MaxVideoAI add to an AI assistant?

<a id="maxvideoai-for-assistants-agents-and-automations" name="maxvideoai-for-assistants-agents-and-automations"></a>

Describe the creative brief in your assistant. MaxVideoAI supplies the live model catalog, checks the inputs the selected workflow needs, prices a concrete request and returns the result to your account. You can plan before funding a shoot. Connecting is free, and your existing MaxVideoAI credits and private Library follow the account you authorize. [MaxVideoAI integration guide](https://maxvideoai.com/mcp) · [How the workflow works](docs/how-it-works.md)

### What can you create?

Start with text to make an image or a video. To animate an existing product photo, choose a model that accepts a first frame and describe what should move. A last frame, a reference video or a soundtrack changes the choice of workflow. The model page identifies supported inputs, and the examples gallery shows what a real output looks like alongside its settings. [Model catalog](https://maxvideoai.com/models) · [Generation examples](https://maxvideoai.com/examples) · [Reference-to-video guide](examples/reference-to-video.md)

```text
I have a first frame and a separate audio track. Which modes in this
connection accept both? Show their input limits before I upload either.
```

### Which preparation and finishing tools are available?

The published ChatGPT listing includes voiceovers, sound effects, character creation, Recast, Studio editing and subtitles. In a custom MCP client, check the tools returned by that connection before planning a finishing step. On the website, the tools catalog describes what you can do with existing media, including captioning a finished clip. [ChatGPT listing](https://chatgpt.com/plugins/plugin_asdk_app_6af7c45d28c48191982cf5be6eb7e058) · [MaxVideoAI tools](https://maxvideoai.com/tools)

## Which setup should you use?

Use the official plugin listing for ChatGPT, the custom remote connector for Claude, or the tagged package for Codex. If your organization runs its own MCP client, it needs **remote Streamable HTTP and OAuth**. Enter the endpoint below, open browser authorization, then check which tools that client exposes. The registry entry describes the shared remote service. [Generic MCP setup](docs/generic-mcp.md) · [MCP Registry record](https://registry.modelcontextprotocol.io/v0.1/servers/com.maxvideoai%2Fmaxvideoai/versions/latest)

```text
https://api.maxvideoai.com/mcp
```

### Connect MaxVideoAI in Claude

In **Customize → Connectors**, add a custom connector using the endpoint above, choose **Connect** and authorize your MaxVideoAI account. In a managed workspace, an authorized administrator adds the connector first. MaxVideoAI documents this direct setup separately from Anthropic’s Connectors Directory. [Claude setup and first request](docs/claude.md) · [Claude production example](examples/claude-video-production.md) · [Anthropic’s custom connector instructions](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)

On 19 October 2026, the Claude Web Free production check covered OAuth, model discovery, an exact quote and recovery of an existing result. The paid generation step was outside that check. The Claude Desktop inline result came from a separate controlled test. [MaxVideoAI’s Claude evidence](https://maxvideoai.com/integrations/claude)

### Agent and automation paths

- **OpenClaw.** Connect the remote MCP server or use the packaged skill. Private file imports and inline playback depend on the channel. Check the published limits before designing a workflow around either one. [OpenClaw setup and limits](https://maxvideoai.com/integrations/openclaw)
- **Self-hosted n8n.** Configure OAuth manually and use one MCP Client node per action. Put the price and human approval step before the generation node. The documented execution path uses a deterministic workflow. [n8n workflow and tested scope](https://maxvideoai.com/integrations/n8n)

A useful first check after connecting is a read-only request.

```text
Show my connected account and the models available for planning.
```

## How do you compare models side by side?

Match the model to the hardest shot. For a moving product, check which models retain an opening image and which camera moves the mode accepts. For dialogue, check whether the route supports the audio you need. Hold duration, resolution, framing and audio settings constant where possible. When they differ, ask the assistant to explain what changed before comparing prices. [Model comparison hub](https://maxvideoai.com/ai-video-engines) · [Compare models in an assistant](examples/compare-ai-video-models.md)

For **Paper Run**, see the prompt and three MaxVideoAI estimates recorded on 27 November 2026 at 23:10 UTC for a five-second, 720p text-to-video take. An image-guided take needs its own comparison. [Prompt, settings and dated estimates](https://github.com/camgraphe/MaxVideoAi/blob/main/docs/marketing/github-examples/paper-run-price-check.md)

### Budget a multi-shot production

Price the source takes for the edit you intend to make. List the model, supported take length, format, audio and planned number of attempts for each shot. A six-second edit can require three separately priced clips. Keep the same shot list when comparing a consistent-model route with a mixed-model route, then decide where a more expensive take serves the film. [Project budgeting workflow](examples/price-a-video-project.md) · [Create two comparable budgets](examples/creator-budget-comparison.md)

```text
Budget an approach, an unfolding ribbon and an exit. Show the price of
one supported take per shot and the project total. Then show how the
total changes if I reserve a second take for the ribbon alone.
```

## How do pricing and approval stay clear?

<a id="price-a-shot-and-keep-the-result" name="price-a-shot-and-keep-the-result"></a>

Compare estimates at the same duration, aspect ratio, resolution and audio settings where both models support them. Check the settings on the final quote. Planning is free. Generation draws on your MaxVideoAI credits after approval. [MaxVideoAI pricing](https://maxvideoai.com/pricing?utm_source=github&utm_medium=repository&utm_campaign=assistant_video_plugin&utm_content=pricing)

With MaxVideoAI in a compatible assistant, review the exact quote and approve one paid attempt. Completed media is saved to your MaxVideoAI Library. [MaxVideoAI integration guide](https://maxvideoai.com/mcp)

If you change the model, prompt, duration or reference after reviewing the price, prepare a quote for the revised request. If your balance is too low, fund the connected account on the MaxVideoAI website, then check the fresh quote before approving. [Quote, payment and retry rules](skills/generate/references/generation-safety.md)

```text
Prepare the exact quote for the selected five-second take with these
settings. Show the total and wait for my approval.
```

## How do private references and the Library work?

Choose an image, video or audio asset you own in the connected MaxVideoAI Library. Check the selected model’s requirements, including media type, reference order and duration. An image-to-video mode may need a first frame, while a first-and-last-frame workflow needs both in their correct roles. [Reference input guide](skills/generate/references/reference-inputs.md)

A compatible chat host can import an authorized attachment privately. When the file is on your computer, the Codex or Claude Code upload helper reads the local bytes and sends them to an authorized MaxVideoAI upload destination. The assistant uses the resulting asset ID. You can keep the original file off the public web. [Private reference imports](skills/generate/references/reference-inputs.md) · [Permissions and revocation](docs/privacy-and-permissions.md)

If a reply stops after approval, ask for the existing result.

```text
Find the last job I approved. Show me its status or the finished clip.
```

[Open your Library](https://maxvideoai.com/app/library?utm_source=github&utm_medium=repository&utm_campaign=assistant_video_plugin&utm_content=library) · [Recover a generation](examples/recover-a-generation.md)

If the accepted job fails, check its status and any recorded refund before requesting a replacement. A creative retry or a replacement after a refund requires a new quote and new approval. [Recovery guide](examples/recover-a-generation.md) · [Generation safety](skills/generate/references/generation-safety.md)

## How is the plugin packaged?

The repository contains two scoped skills, host manifests, remote connection configuration, private upload support and human setup guides. The server handles account access, pricing and generation. The assistant uses its host tools for the creative conversation. [Remote connection configuration](.mcp.json) · [Codex manifest](.codex-plugin/plugin.json) · [How it works](docs/how-it-works.md)

```text
skills/plan/                     compare models and budget a project
skills/generate/                 prepare a quote, approve and recover a job
scripts/import-reference-files.mjs  import an authorized local file
```

The ChatGPT directory showed native plugin **0.3.29** on 27 November 2026. The installable Codex release was **v0.3.8** and the MCP Registry listed generic server **0.3.9** at the same check. Each version belongs to the distribution named alongside it. [Codex releases](https://github.com/camgraphe/maxvideoai-plugin/releases) · [Registry record](https://registry.modelcontextprotocol.io/v0.1/servers/com.maxvideoai%2Fmaxvideoai/versions/latest) · [ChatGPT listing](https://chatgpt.com/plugins/plugin_asdk_app_6af7c45d28c48191982cf5be6eb7e058)

### How do you validate a contribution or release?

Contributors work from the source repository. The release builder checks the public file inventory and image references, writes SHA-256 checksums and creates a versioned ZIP. Compare its checksum with the file supplied on the matching public release. Follow the contribution guide for the review process and use the private security channel for vulnerabilities. [Source builder](https://github.com/camgraphe/MaxVideoAi/blob/main/scripts/build-maxvideoai-plugin-release.mjs) · [Contributing](CONTRIBUTING.md) · [Security reporting](SECURITY.md)

## References and support

- [Browse all assistant workflows](examples/README.md) or [troubleshoot a connection](docs/troubleshooting.md).
- [Get product support](https://maxvideoai.com/contact) · [Email support](mailto:support@maxvideoai.com) · [Privacy policy](https://maxvideoai.com/legal/privacy) · [Terms](https://maxvideoai.com/legal/terms) · [License](LICENSE).
