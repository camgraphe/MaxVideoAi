<a id="use-maxvideoai-with-chatgpt" name="use-maxvideoai-with-chatgpt"></a>
<a id="how-do-i-install-or-connect-maxvideoai" name="how-do-i-install-or-connect-maxvideoai"></a>

# Connect MaxVideoAI in ChatGPT

Install the MaxVideoAI plugin from the ChatGPT directory and connect your MaxVideoAI account. [Open the official ChatGPT listing](https://chatgpt.com/plugins/plugin_asdk_app_6af7c45d28c48191982cf5be6eb7e058)

<a id="what-happens-after-oauth" name="what-happens-after-oauth"></a>

Choose **Install plugin**, then sign in or create the MaxVideoAI account whose credits and Library you want to use. The published listing identifies MaxVideoAI Plan and MaxVideoAI Generation. It offers image and video creation, voices and sound effects, character creation and reuse, Recast scenes, Studio editing, subtitles and downloading finished media. [ChatGPT plugin details](https://chatgpt.com/plugins/plugin_asdk_app_6af7c45d28c48191982cf5be6eb7e058)

Start with the [no-spend verification](#how-do-i-verify-without-spending-credits).

## How do I verify without spending credits?

```text
For a skater trailing a ribbon of folded paper at night, compare two
image-to-video models that accept a still image. Keep duration and framing
the same where supported. Show the estimated price for one take on each
route. Wait for me to choose a model.
```

You can plan before uploading the reference. When you choose the take, select a private reference from your MaxVideoAI Library or attach a file by a supported route. Check the exact quote and connected account before approving one paid attempt. Retrieve the finished output in your MaxVideoAI Library. [MaxVideoAI integration guide](https://maxvideoai.com/mcp) · [Compare video models](../examples/compare-ai-video-models.md) · [Price a video project](../examples/price-a-video-project.md)

## How do I find a clip after an interrupted reply?

Ask ChatGPT for the status of the generation you already approved. Use the accepted job to retrieve the result. [Recovery guide](../examples/recover-a-generation.md) · [Open your MaxVideoAI Library](https://maxvideoai.com/app/library)

<a id="which-chatgpt-plans-and-permissions-support-the-connection" name="which-chatgpt-plans-and-permissions-support-the-connection"></a>
<a id="direct-developer-mcp-connection" name="direct-developer-mcp-connection"></a>

## Advanced setup for a custom MCP connection

The official installation starts with the ChatGPT directory button above. An administrator building a separate, workspace-managed MCP connection can use the generic remote endpoint below.

```text
https://api.maxvideoai.com/mcp
```

In ChatGPT web, open **Plugins**, choose **+**, then **Add custom MCP server** when available. Select OAuth and review the account permissions. Workspace eligibility and controls depend on the host. [OpenAI’s custom MCP guide](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt) · [MaxVideoAI technical reference](https://maxvideoai.com/docs/mcp)

<a id="how-do-i-disconnect-and-revoke-access" name="how-do-i-disconnect-and-revoke-access"></a>

## Disconnect your account

Open the plugin or connected-app settings in ChatGPT and disconnect the MaxVideoAI account. To revoke the authorization in MaxVideoAI, remove the matching connection from your account settings. [Permissions](privacy-and-permissions.md) · [Troubleshooting](troubleshooting.md)

## Sources

- [Published ChatGPT listing](https://chatgpt.com/plugins/plugin_asdk_app_6af7c45d28c48191982cf5be6eb7e058)
- [MaxVideoAI integration hub](https://maxvideoai.com/mcp)

Last reviewed: 2026-11-28.
