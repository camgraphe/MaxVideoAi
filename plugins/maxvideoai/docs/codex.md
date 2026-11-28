<a id="install-the-maxvideoai-package-in-codex" name="install-the-maxvideoai-package-in-codex"></a>
<a id="who-can-currently-use-this-route" name="who-can-currently-use-this-route"></a>

# Install MaxVideoAI in Codex

In a Codex build with plugin marketplace support, add the public MaxVideoAI marketplace, install the plugin and open a new task. The published package is v0.3.8. [Tagged release](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.8) · [MaxVideoAI Codex guide](https://maxvideoai.com/integrations/codex)

## How do I install the Codex plugin?

```sh
codex plugin marketplace add camgraphe/maxvideoai-plugin --ref v0.3.8
codex plugin add maxvideoai@maxvideoai
```

This tag identifies the Codex package. ChatGPT has its own native plugin version, and the generic server has its own MCP Registry record. [MCP Registry entry](https://registry.modelcontextprotocol.io/v0.1/servers/com.maxvideoai%2Fmaxvideoai/versions/latest)

Start a new task so Codex can discover the installed package. Invoke a MaxVideoAI skill and follow browser OAuth when prompted. Sign in or create the MaxVideoAI account whose credits and Library you want to use. [Codex installation steps](https://maxvideoai.com/integrations/codex)

## What OAuth and permissions should I expect?

OAuth connects the package to the account you choose. Planning compares models and budgets without spending credits. Generation requires an exact quote and your explicit approval for one paid attempt.

<a id="how-do-i-verify-the-installation" name="how-do-i-verify-the-installation"></a>

## How do I verify without spending credits?

```text
Use $maxvideoai:plan to compare two ways to film a skateboarder rolling
under a bridge with a paper ribbon unfolding behind the board. Show which models accept my opening frame
and estimate one take at the same settings. Wait for me to choose.
```

Once you choose a shot, use `$maxvideoai:generate` to prepare the exact quote. Explicit approval authorizes one paid attempt. [Paper Run brief and measured estimates](../examples/codex-video-production.md)

## Why can an installed plugin have no tools?

Package discovery, tool discovery and OAuth are separate. Enable the tagged package and open a new task. If MaxVideoAI tools still do not appear, check the connection and use the host’s reconnect action. [Troubleshooting](troubleshooting.md)

### What if the installation source disappeared?

If the package manager points to a missing local source, add the tagged GitHub marketplace again using the [installation command above](#how-do-i-install-the-codex-plugin).

### How do local reference files reach my Library?

When the host cannot pass an attachment, request a private upload destination and use the browser or the package’s local helper. [Reference inputs and local helper](../skills/generate/references/reference-inputs.md)

## What if a job is already running?

Ask Codex for the accepted job.

```text
Find the job I already approved and give me the finished clip when it is ready.
```
 Review the completed clip in your Library before pricing another take. [Recovery guide](../examples/recover-a-generation.md) · [MaxVideoAI Library](https://maxvideoai.com/app/library)

<a id="how-do-i-remove-or-disconnect-it" name="how-do-i-remove-or-disconnect-it"></a>

## Disconnect your account

Remove or disable the MaxVideoAI package in the Codex plugin manager. Revoke the corresponding OAuth connection in your MaxVideoAI account settings if you want to end its access. [Permissions and account access](privacy-and-permissions.md)

### Which practical examples should I use?

Start with [model comparison](../examples/compare-ai-video-models.md) or [project budgeting](../examples/price-a-video-project.md).

### What does this guide prove today?

The tagged package and its manifest document the installable Codex configuration. For tests by host, see the [MaxVideoAI compatibility guide](https://maxvideoai.com/docs/mcp).

## Sources

- [Published Codex package manifest](https://github.com/camgraphe/maxvideoai-plugin/blob/v0.3.8/.codex-plugin/plugin.json)
- [MaxVideoAI host compatibility evidence](https://maxvideoai.com/docs/mcp)

Last reviewed: 2026-11-28.
