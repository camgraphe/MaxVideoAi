# Connect MaxVideoAI to Claude

**Short answer:** Claude currently documents custom remote MCP connectors for Free, Pro, Max, Team, and Enterprise plans. Free users are limited to one custom connector. Individual users start from **Customize → Connectors → + → Add custom connector**; Team and Enterprise owners first add the connector for their organization. Complete browser OAuth, then verify with a no-spend planning prompt.

## What does this guide prove today?

![Completed MaxVideoAI workspace result paired with the same saved video in the MaxVideoAI Library](../assets/demos/brief-to-video-workflow.webp)

This is current MaxVideoAI product proof, not native Claude host proof. Fresh exact-host Claude installation and end-to-end generation evidence has not been published. Use the steps below to validate the setup in your own eligible Claude account.

## Who can currently use this route?

Anthropic's current documentation lists Claude, Cowork, and Claude Desktop users on Free, Pro, Max, Team, and Enterprise plans. Free users are limited to one custom connector. On Team and Enterprise, an Owner or Primary Owner adds the connector for the organization; each member then connects it to their own authorized MaxVideoAI account.

## How do I add the Claude connector?

**Free, Pro, and Max:** **Customize → Connectors → + → Add custom connector**.

1. Enter `MaxVideoAI` and `https://api.maxvideoai.com/mcp` exactly. Do not add a token, query string, password, or API key.
2. Choose **Add**, then **Connect**.
3. Complete MaxVideoAI OAuth in the browser. Sign in or create the account you want Claude to use.

**Team and Enterprise owners:** **Organization settings → Connectors → Add → Custom → Web**.

1. Enter `https://api.maxvideoai.com/mcp` exactly and choose **Add**.
2. Members then open **Customize → Connectors**, find MaxVideoAI, and choose **Connect**.
3. Each member completes OAuth with their own authorized MaxVideoAI account.

In a conversation, use **+ → Connectors** to enable MaxVideoAI only where it is relevant.

```text
Remote MCP URL: https://api.maxvideoai.com/mcp
Authentication: browser OAuth
```

## What OAuth and permissions should I expect?

OAuth lets you grant access without sharing your MaxVideoAI password with Claude. MaxVideoAI can read current model facts, your authorized account state, and private Library media when the workflow needs them. Preparing a quote does not spend credits. Only explicit approval of an exact quote authorizes one paid generation attempt.

Review Claude's tool request before allowing it. Anthropic recommends connecting only trusted servers, limiting enabled tools, and paying particular attention to actions that write data or spend money.

## How do I verify the connection safely?

Start with a no-spend planning request. Confirm that Claude can return current model options and that it does not ask for generation approval.

**Example**: “Use MaxVideoAI to compare current models for a three-shot product film. Create two named budgets, but do not prepare or approve a generation.”

If tools are missing, reopen **Customize → Connectors**, confirm MaxVideoAI is connected, enable it from **+ → Connectors**, then start a new conversation. Treat success in your account as local verification; do not infer support for every Claude device or future interface.

## How do I disconnect or revoke access?

Open **Customize → Connectors**, find MaxVideoAI, then use **Remove** or the adjacent menu to disconnect it. Team and Enterprise owners can remove the organization entry from **Organization settings → Connectors**. To end the authorization as well, revoke the Claude connection from your MaxVideoAI account connection settings. Reconnect through OAuth if you need it later.

## Sources

- [Claude Help Center: Get started with custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [MaxVideoAI compatibility evidence](https://maxvideoai.com/docs/mcp)

Last reviewed: 2026-08-28.
