# Use MaxVideoAI with ChatGPT

ChatGPT and Codex use the same MaxVideoAI plugin and the same MCP connection. Install or connect, then complete OAuth on the first use. From there, you can compare current video models, prepare an exact quote, approve one paid attempt, and recover finished work in the MaxVideoAI Library.

For a safe first request, jump to the [no-spend verification](#how-do-i-verify-without-spending-credits).

```text
Install or connect → OAuth on first use → review tools → plan without spending → approve one quoted attempt → recover from the Library
```

## Which ChatGPT plans and permissions support the connection?

OpenAI's current beta documentation says full MCP, including write and modify actions, is available on ChatGPT web for Business and Enterprise/Edu workspaces. Business admins or owners enable developer mode and create apps. Enterprise/Edu admins can grant developer access through role controls; admins or owners publish apps.

Pro users can enable developer mode for MCPs limited to read/fetch permissions. That permission set supports discovery and planning, but not the complete MaxVideoAI generation journey.

```text
Full MCP beta: Business and Enterprise/Edu on ChatGPT web
Pro: read/fetch MCP permissions in developer mode
```

## How do I install or connect MaxVideoAI?

The MaxVideoAI plugin is designed for the shared ChatGPT and Codex directory. Public directory availability begins after the listing is approved.

### Public directory plugin

After approval, go to **Plugins** in ChatGPT, or **Apps** if that is shown for your rollout or account:

1. Select MaxVideoAI.
2. Choose **Install plugin** if shown.
3. Choose **Connect** if prompted, then complete OAuth in your browser.

To invoke MaxVideoAI in ChatGPT, mention `@MaxVideoAI`, or choose **+ → More → MaxVideoAI**, when those controls are available for your account.

### Direct developer MCP fallback

For eligible workspaces that need a direct connection, the developer MCP URL fallback is `https://api.maxvideoai.com/mcp`:

1. Confirm that your plan and role permit developer mode under OpenAI's current beta rules.
2. Enable developer mode from the Apps advanced settings or workspace permissions available to your role.
3. Open **Apps → Create** from workspace or user settings, as permitted.
4. Enter the MaxVideoAI name and `https://api.maxvideoai.com/mcp`.
5. Select OAuth authentication. Never add a token, query string, password, or API key to the endpoint.
6. Choose **Scan Tools**, complete MaxVideoAI browser OAuth, review the discovered tools, and create the connection.

```text
Remote MCP endpoint: https://api.maxvideoai.com/mcp
Authentication: OAuth on first use
Directory route: available after public listing approval
```

## What happens after OAuth?

OAuth opens MaxVideoAI in your browser so you can sign in or create an account without giving ChatGPT your password. The connection then uses that MaxVideoAI account, its credits, and its Library. Review the scanned tools and the permissions ChatGPT presents before continuing.

Planning reads current product facts and can calculate named budgets without spending credits. Generation tools prepare the selected model, prompt, settings, and supported references, then return an exact quote. Only an explicit approval authorizes one paid attempt; a changed request needs a fresh quote.

![Completed MaxVideoAI video continuing from the production workspace into the Library](../assets/demos/brief-to-video-workflow.webp)

*MaxVideoAI product proof: this composite shows the same completed result continuing from the MaxVideoAI production workspace into the Library. It is not native ChatGPT host proof and does not prove an assistant quote, approval, or generation.*

## How do I verify without spending credits?

Start with a planning request that cannot spend credits:

**Example**: “Use MaxVideoAI to compare current AI video models for a 15-second product film. Give me two named budgets and stop before any paid generation.”

Then move to a concrete request only when the model, prompt, settings, and supported references are ready. Review the exact quote before approving one attempt. If a response is interrupted after submission, check the accepted job or recent generations before considering another paid request.

- [Compare current AI video models](../examples/compare-ai-video-models.md) before selecting a route.
- [Price an AI video project](../examples/price-a-video-project.md) before preparing work.
- [Review the complete workflow](how-it-works.md) before a first paid generation.

## How do I disconnect and revoke access?

**Public plugin installation:** workspace admins manage the plugin under **Workspace settings → Plugins**.

**Underlying app connection:** users manage the app connection or connected account from **Settings → Apps**, or from the connection surface where shown for their account, then choose **Disconnect** when available.

**Authorization:** revoke the corresponding MaxVideoAI OAuth connection from your MaxVideoAI account connection settings. Disconnecting the app connection in ChatGPT does not replace that MaxVideoAI-side revocation.

```text
Manage the workspace plugin → disconnect the app connection → revoke the MaxVideoAI OAuth connection
```

## Sources

- [OpenAI: Developer mode and MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta)
- [OpenAI: Apps in ChatGPT](https://help.openai.com/en/articles/11487775-connectors-in-chatgpt)
- [OpenAI: Plugins in Codex](https://help.openai.com/en/articles/20001256-plugins-in-codex)
- [MaxVideoAI compatibility evidence](https://maxvideoai.com/docs/mcp)

Last reviewed: 2026-08-28.
