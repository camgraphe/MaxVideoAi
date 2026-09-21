# Install the MaxVideoAI package in Codex

**Short answer:** add the tagged MaxVideoAI repository as a Codex plugin marketplace, install the package, then start a new task and invoke `$maxvideoai:plan` or `$maxvideoai:generate`. These are package/repository installation instructions validated against the current plugin creator tooling and checked-in package, not external marketplace approval or native Codex host proof.

## What does this guide prove today?

![Current MaxVideoAI home page paired with the public MCP section showing a completed video result in Claude](../assets/demos/readme-proof-hero.webp)

This is current public MaxVideoAI product proof plus Claude-specific evidence, not native Codex host proof. Codex service behavior was exercised during launch work, but no fresh privacy-reviewed native Codex capture is published here.

## Who can currently use this route?

Use this route in a Codex build that exposes plugin marketplace installation and can load the checked-in MaxVideoAI package. Command availability can vary by build. If `codex plugin` is not recognized, your local host has not verified this path; update or use the plugin manager available in that Codex surface.

## How do I install the Codex plugin?

Run the reviewed release-tag commands from your terminal:

```sh
codex plugin marketplace add camgraphe/maxvideoai-plugin --ref v0.3.6
codex plugin add maxvideoai@maxvideoai
```

Then:

1. Start a new Codex task so it discovers the newly installed package.
2. Invoke `$maxvideoai:plan` for model comparison and project budgeting, or `$maxvideoai:generate` for a concrete request.
3. Complete MaxVideoAI OAuth in the browser when the first live action asks you to connect.
4. Sign in or create the MaxVideoAI account whose credits and Library you want to use.

The tagged reference keeps the marketplace definition, two skills, and remote MCP endpoint aligned to the same reviewed package version.

## What OAuth and permissions should I expect?

The package contains no embedded token, password, copied model catalogue, pricing table, or customer data. OAuth connects Codex to the MaxVideoAI account you choose. `$maxvideoai:plan` reads current model facts and calculates budgets without spending credits. `$maxvideoai:generate` can prepare an exact quote; only your explicit approval authorizes one paid attempt.

Review the request before approval. If a response is interrupted after submission, recover the accepted job instead of authorizing a duplicate.

## How do I verify the installation?

Start a new task and ask for a no-spend plan. A valid response should compare current executable model options and produce named budgets without preparing paid work.

**Example**: “Use `$maxvideoai:plan` to compare current models for a cinematic product reveal. Give me a quality-first budget and a lower-cost budget.”

If `$maxvideoai:plan` is not discovered, verify the tagged marketplace and package are enabled, then start another new task. Package discovery alone is not proof that OAuth or the full production path completed.

## Why can an installed plugin have no tools?

Package discovery, tool discovery, and OAuth authentication are separate states.
The two skills allow implicit invocation, but the host decides whether a request
matches them. You can also explicitly select `$maxvideoai:plan` or
`$maxvideoai:generate`. Neither route bypasses account authentication.

```text
Package installed → tools discovered → account connected → workflow ready
                                           ↑
                              Reconnect here if OAuth is rejected
```

If the skill is present but its tools are missing:

1. Search available or deferred tools for MaxVideoAI. An empty MCP resource list
   does not prove tools are missing.
2. Inspect the connection status. For OAuth reauthentication, use the host's
   reconnect action or `codex mcp login maxvideoai`, then sign in to the intended
   account in the browser.
3. Check `codex --version` if that fails. The terminal CLI may be older than the
   desktop app. Use the app's plugin manager or verified bundled CLI; do not
   change configuration to accommodate an obsolete binary.
4. Rediscover tools and resume the saved brief. If unavailable, start a new task
   with that brief and report the connection error. Lost authentication alone
   does not require reinstallation.

## What if the installation source disappeared?

If the marketplace itself points to a missing local or temporary directory,
repair its source using the tagged Git repository in the installation command
above. A cached plugin can remain installed after its original local source has
disappeared; that source cannot reliably supply later updates.

No sign-in or reconnection authorizes generation. An exact quote and explicit
approval are still required before a paid attempt.

## How do local reference files reach my Library?

When the host cannot expose an attachment handle, create one upload destination
per file with `create_reference_upload_link`. Run the included helper with Node.js
from the installed package root:

```sh
node scripts/import-reference-files.mjs --upload '<returned upload URL>' '/absolute/path/reference.png'
```

Replace the placeholders with the returned destination and the authorized local
file. Repeat `--upload` for up to eight files, each with its own destination.
Keep successful asset IDs and retry only failed files with fresh destinations.
The local path stays on the machine; the helper uploads into the account's private
Library. If Node.js is unavailable, use the returned browser destination.

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

- [MaxVideoAI package repository](https://github.com/camgraphe/maxvideoai-plugin)
- [MaxVideoAI compatibility evidence](https://maxvideoai.com/docs/mcp)
- Public `.claude-plugin/marketplace.json` and `.codex-plugin/plugin.json` at release tag `v0.3.6`

Last reviewed: 2026-09-22.
