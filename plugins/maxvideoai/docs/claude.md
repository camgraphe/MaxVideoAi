# Connect MaxVideoAI to Claude

Use MaxVideoAI in Claude by adding its custom remote MCP connector and authorizing your account. This is the direct setup path documented by MaxVideoAI. Its submission record describes the Anthropic Connectors Directory entry as unsubmitted. [MaxVideoAI setup and compatibility](https://maxvideoai.com/integrations/claude) · [Directory submission record](https://github.com/camgraphe/MaxVideoAi/blob/5677f44e089b20fe18466d713fac199ab60f093c/docs/marketing/mcp-directory-submissions.md#anthropic-direct-claude-custom-connector)

## How do I add the Claude connector?

In an individual account with custom connectors, open **Customize → Connectors**, choose **+ → Add custom connector** and name it MaxVideoAI. Enter this URL exactly.

```text
https://api.maxvideoai.com/mcp
```

Choose **Connect**, sign in to MaxVideoAI in the browser and review the permissions. In a managed Team or Enterprise workspace, a permitted administrator adds the custom connector in **Organization settings → Connectors**. Members then choose **Connect** under **Customize → Connectors**. [Anthropic’s connector instructions](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)

## What does this guide prove today?

Claude Web Free was checked in production on **19 October 2026**. The test covered OAuth, model discovery, a quote and recovery of an existing result. The **26 August 2026** Desktop staging check on **1.37937.1** showed a completed video inline. Claude Code awaits a production check. [MaxVideoAI Claude evidence](https://maxvideoai.com/integrations/claude) · [Dated host checks](https://github.com/camgraphe/MaxVideoAi/blob/5677f44e089b20fe18466d713fac199ab60f093c/docs/operations/mcp-host-compatibility-matrix.md)

### Who can currently use this route?

Anthropic documents custom connectors for Free, Pro, Max, Ultra, Team and Enterprise. Free users can add one custom connector. Workspace permissions govern managed access. [Claude custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)

### What OAuth and permissions should I expect?

Sign in to the intended MaxVideoAI account and review the permissions. Account access lets Claude look up available models and quote concrete requests. An exact quote and your explicit approval are required for a paid generation. [MaxVideoAI permissions](privacy-and-permissions.md) · [MaxVideoAI integration guide](https://maxvideoai.com/mcp)

## How do I verify the connection safely?

```text
Show the MaxVideoAI account I connected and compare two models for a
five-second shot. Give me an estimate and wait for me to choose a model.
```

## How do I disconnect or revoke access?

Remove the connector under **Customize → Connectors** in Claude. Revoke the matching OAuth connection in your MaxVideoAI account settings. [MaxVideoAI connection help](https://maxvideoai.com/integrations/claude)

### Which practical examples should I use?

[Compare models for the same shot](../examples/compare-ai-video-models.md), [price a project](../examples/price-a-video-project.md), [prepare a shot in Claude](../examples/claude-video-production.md) or [recover the accepted job](../examples/recover-a-generation.md).

## Sources

- [MaxVideoAI’s Claude setup and recorded checkpoints](https://maxvideoai.com/integrations/claude)
- [Anthropic’s custom connector instructions](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [Generic MaxVideoAI MCP Registry record](https://registry.modelcontextprotocol.io/v0.1/servers/com.maxvideoai%2Fmaxvideoai/versions/latest)

Last reviewed: 2026-11-28.
