# Validate MaxVideoAI in an eligible ChatGPT workspace

**Short answer:** OpenAI currently offers full MCP in beta on ChatGPT web for Business and Enterprise/Edu workspaces; Pro users can connect MCPs with read/fetch permissions in developer mode. The exact MaxVideoAI ChatGPT production-host path remains unverified, so this is a setup guide to validate in your eligible workspace—not an availability promise.

## What does this guide prove today?

![MaxVideoAI workspace with the Luma Ray 2 Flash selector and completed glass-ribbon video](../assets/demos/model-choice-and-budget.webp)

This is current MaxVideoAI product proof, not native ChatGPT host proof. It shows product selection and a completed result, not ChatGPT execution, an exact quote, approval, or a budget.

## Who can currently use this route?

OpenAI's current beta documentation says full MCP, including write and modify actions, is for Business and Enterprise/Edu customers on ChatGPT web. Business admins or owners enable developer mode and create apps. Enterprise/Edu admins can grant developer access through role controls; admins or owners publish apps. Pro users can enable developer mode for MCPs limited to read/fetch permissions, which does not establish the complete MaxVideoAI generation path.

```text
Full MCP beta: Business and Enterprise/Edu on ChatGPT web
Pro: read/fetch MCP permissions in developer mode
```

## How do I create the draft app?

1. Confirm your plan and role are eligible under OpenAI's current beta rules.
2. Enable developer mode from the Apps advanced settings or the workspace permissions area available to your role.
3. Open **Apps → Create** from workspace or user settings, as permitted.
4. Enter the MaxVideoAI name, `https://api.maxvideoai.com/mcp`, and the metadata requested by ChatGPT.
5. Select OAuth authentication. Do not place a token, query string, password, or API key in the endpoint.
6. Choose **Scan Tools**, complete MaxVideoAI browser OAuth, and wait for the scan to finish.
7. Choose **Create**. Keep the app as a draft while you review its tools and permissions.
8. Start a new chat and select the draft app from the tools menu for the message you want to test.

```text
Remote MCP endpoint: https://api.maxvideoai.com/mcp
Authentication: OAuth
Initial state: draft app for private validation
```

## What OAuth and permissions should I expect?

OAuth opens MaxVideoAI in your browser so you can sign in or create an account without giving ChatGPT your password. Review the scanned tools before testing. Planning reads current product facts and can calculate budgets without spending credits. Generation tools can prepare a quote and, only after explicit approval, authorize one paid attempt.

OpenAI warns that custom MCP apps must be vetted by the workspace adding them. Write or modify actions may trigger host confirmation, and workspace administrators can limit actions or access according to the current plan controls.

## How do I verify without spending credits?

Select the draft app for one message and ask for planning only. Confirm that the response uses current MaxVideoAI model information and does not request generation approval.

**Example**: “Use MaxVideoAI to compare current AI video models for a 15-second product film. Give me two named budgets and stop before any paid generation.”

If the draft cannot scan or call tools, do not treat the setup as verified. Check developer-mode access, app permissions, OAuth, and the current OpenAI plan restrictions before retrying.

## How do I disable or disconnect it?

Users can open **Settings → Apps**, select the MaxVideoAI app, and choose **Disconnect**. Workspace admins or owners can disable it from **Workspace settings → Apps** and remove draft or published access when it is no longer approved. Then revoke the corresponding OAuth connection in your MaxVideoAI account connection settings; disabling the app in ChatGPT does not replace that MaxVideoAI-side revocation.

## Which practical examples should I use?

- [Compare current AI video models](../examples/compare-ai-video-models.md) before selecting a route.
- [Price an AI video project](../examples/price-a-video-project.md) before preparing a request.
- [Plan a Claude video-production request](../examples/claude-video-production.md) for the no-spend workflow shape.
- [Run a Codex video-production workflow](../examples/codex-video-production.md) for package and recovery context.

## Sources

- [OpenAI: Developer mode and MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta)
- [OpenAI: Apps in ChatGPT](https://help.openai.com/en/articles/11487775-connectors-in-chatgpt)
- [MaxVideoAI compatibility evidence](https://maxvideoai.com/docs/mcp)

Last reviewed: 2026-08-28.
