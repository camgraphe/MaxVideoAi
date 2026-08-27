# Troubleshoot MaxVideoAI without duplicating paid work

**Short answer:** reconnect OAuth when authorization fails, refresh the host when tools are missing, and recover an accepted job when a response times out. Never repeat a paid confirmation merely because the conversation stopped. A refunded attempt does not authorize a replacement; prepare a fresh quote and ask for new approval.

## OAuth opens, but the connection does not finish

![MaxVideoAI production workspace showing a completed Luma Ray 2 Flash video and playback controls](../assets/screenshots/maxvideoai-workspace-production.jpg)

This is current MaxVideoAI product proof, not native host proof. It confirms the production workspace result, not the host's OAuth screen or connection state.

Remove the incomplete connector, then add `https://api.maxvideoai.com/mcp` again without a token, query string, password, or API key. Allow the browser redirect to return to the host. If your organization manages connectors, confirm your plan, role, and admin policy before retrying.

## The host cannot find MaxVideoAI tools

Start a new conversation or task after installation. Confirm the connector or plugin is enabled for that message and refresh or rescan tools if the host supports it. For Codex, verify the tagged package was added before the plugin. For Claude and ChatGPT, revisit the current platform guide because setup and permissions are beta surfaces.

```text
Endpoint: https://api.maxvideoai.com/mcp
Expected authentication: browser OAuth
First safe check: current model planning without generation
```

## The response stopped after I approved

Do not approve again and do not submit a fresh request. Ask MaxVideoAI to check the accepted job or list recent generations, then recover the completed or refunded outcome.

**Example**: “The response stopped after approval. Check the accepted job and recover its result. Do not create another paid attempt.”

If no accepted job can be identified, stop before spending and contact support with the approximate time, host, and non-sensitive request details. Do not send credentials or private media by email.

## The job failed or was refunded

When MaxVideoAI reports a technical failure as refunded, the original authorization is consumed and closed. A retry is a new paid attempt: adjust the request if needed, prepare a fresh exact quote, and request new explicit approval. Do not treat the refund as permission to resubmit automatically.

If credits are insufficient, use the secure MaxVideoAI top-up destination returned by the workflow. After funding, refresh account status and prepare a fresh quote because an old quote may no longer be valid.

## A reference is missing or rejected

![Same completed glass-ribbon video shown in the MaxVideoAI workspace and saved Library asset](../assets/demos/library-continuity.webp)

Confirm the reference belongs to the connected MaxVideoAI Library and that the selected model mode accepts that image, video, or audio type. If it is not yet in the Library, request a secure upload destination. Never replace a rejected reference with unrelated media or expose raw private identifiers in public reports.

## Where can I get help?

Use the [MaxVideoAI contact page](https://maxvideoai.com/contact) or email [support@maxvideoai.com](mailto:support@maxvideoai.com). Include the host, package version, approximate time, and whether a quote was merely prepared or explicitly approved. Send vulnerability reports privately to [security@maxvideoai.com](mailto:security@maxvideoai.com).

## Sources

- [MaxVideoAI connection guide](https://maxvideoai.com/docs/mcp)
- [MaxVideoAI security policy](../SECURITY.md)
- [Generation safety contract](../skills/generate/references/generation-safety.md)

Last reviewed: 2026-08-28.
