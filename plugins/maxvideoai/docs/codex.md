# Install the MaxVideoAI package in Codex

**Short answer:** add the tagged MaxVideoAI repository as a Codex plugin marketplace, install the package, then start a new task and invoke `$plan` or `$generate`. These are package/repository installation instructions validated against the current plugin creator tooling and checked-in package, not external marketplace approval or native Codex host proof.

## What does this guide prove today?

![MaxVideoAI production workspace showing the completed glass-ribbon video as the dominant proof](../assets/demos/readme-proof-hero.webp)

This is current MaxVideoAI product proof, not native Codex host proof. Codex service behavior was exercised during launch work, but no fresh privacy-reviewed native Codex capture is published here.

## Who can currently use this route?

Use this route in a Codex build that exposes plugin marketplace installation and can load the checked-in MaxVideoAI package. Command availability can vary by build. If `codex plugin` is not recognized, your local host has not verified this path; update or use the plugin manager available in that Codex surface.

## How do I install the Codex plugin?

Run the reviewed release-tag commands from your terminal:

```sh
codex plugin marketplace add camgraphe/MaxVideoAi --ref maxvideoai-plugin-v0.2.0
codex plugin add maxvideoai@maxvideoai
```

Then:

1. Start a new Codex task so it discovers the newly installed package.
2. Invoke `$plan` for model comparison and project budgeting, or `$generate` for a concrete request.
3. Complete MaxVideoAI OAuth in the browser when the first live action asks you to connect.
4. Sign in or create the MaxVideoAI account whose credits and Library you want to use.

The tagged reference keeps the marketplace definition, two skills, and remote MCP endpoint aligned to the same reviewed package version.

## What OAuth and permissions should I expect?

The package contains no embedded token, password, copied model catalogue, pricing table, or customer data. OAuth connects Codex to the MaxVideoAI account you choose. `$plan` reads current model facts and calculates budgets without spending credits. `$generate` can prepare an exact quote; only your explicit approval authorizes one paid attempt.

Review the request before approval. If a response is interrupted after submission, recover the accepted job instead of authorizing a duplicate.

## How do I verify the installation?

Start a new task and ask for a no-spend plan. A valid response should compare current executable model options and produce named budgets without preparing paid work.

**Example**: “Use `$plan` to compare current models for a cinematic product reveal. Give me a quality-first budget and a lower-cost budget.”

If `$plan` is not discovered, verify the tagged marketplace and package are enabled, then start another new task. Package discovery alone is not proof that OAuth or the full production path completed.

## How do I remove or disconnect it?

Use the plugin manager in the Codex build that installed MaxVideoAI and remove `maxvideoai@maxvideoai`. If your build offers CLI removal, check its own `codex plugin --help` output rather than guessing a command. Revoke the Codex OAuth connection in your MaxVideoAI account connection settings to end account access.

```text
Remove the package in Codex → revoke the Codex OAuth connection in MaxVideoAI → reconnect only when needed
```

## Which practical examples should I use?

- [Compare current AI video models](../examples/compare-ai-video-models.md) before selecting a route.
- [Price an AI video project](../examples/price-a-video-project.md) before preparing a request.
- [Run a Codex video-production workflow](../examples/codex-video-production.md) for package and recovery context.

## Sources

- [MaxVideoAI package repository](https://github.com/camgraphe/MaxVideoAi)
- [MaxVideoAI compatibility evidence](https://maxvideoai.com/docs/mcp)
- Checked-in `.agents/plugins/marketplace.json` and `plugins/maxvideoai/.codex-plugin/plugin.json` at release tag `maxvideoai-plugin-v0.2.0`

Last reviewed: 2026-08-28.
