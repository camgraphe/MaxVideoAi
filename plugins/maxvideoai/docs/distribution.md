# Distribution and installation status

Checked: **2026-08-28**.

MaxVideoAI's distributable MCP metadata names the protocol-generic endpoint
`https://api.maxvideoai.com/mcp`. This document distinguishes direct setup from
directory distribution so that an installation path is never mistaken for a
platform approval or a directory record.

## Direct installation

Use the setup material on [MaxVideoAI's MCP page](https://maxvideoai.com/mcp)
for the canonical endpoint, account requirements, and current support links.
Direct configuration may be documented for an exact client only after a
clean-account production check records installation, consent, tool behavior,
revocation, recovery, and support reproduction. A direct URL is not a
directory record.

### Direct ChatGPT configuration

Treat a direct ChatGPT route as its own evidence gate, separate from the
ChatGPT/OpenAI directory. The [OpenAI MCP guide](https://learn.chatgpt.com/docs/extend/mcp)
distinguishes ChatGPT web plugins from local Codex connections; it does not
record a MaxVideoAI production setup on an exact ChatGPT host. Do not publish
ChatGPT-specific setup or compatibility copy until MCP Engineering records the
client/version, installation route, consent, tool behavior, revocation,
recovery, and support reproduction.

## Verified clients

No host is described here as verified for MaxVideoAI. A verified-client entry
requires dated, exact-host evidence owned by MCP Engineering; the evidence must
name the client, version, installation route, production endpoint, and the
tested account/authentication and recovery outcomes. Update this section only
when that evidence is reviewed and still current.

## Compatible MCP clients

The `server.json` metadata uses Streamable HTTP, the transport recommended in
the [official remote-server guidance](https://modelcontextprotocol.io/registry/remote-servers).
An MCP client may support that transport without being verified for MaxVideoAI.
Do not translate protocol compatibility into a named-client claim without the
verified-client evidence above.

## Directory status

- **Official MCP Registry — prepared, not submitted.** Its current terms place
  submitted metadata in CC0 on a perpetual and irrevocable basis, and the FAQ
  says publisher unpublish is not currently available. Legal must accept those
  consequences before an authorized owner publishes anything.
- **ChatGPT/OpenAI directory — do not submit.** OpenAI's current plugin
  guidelines prohibit commerce for digital products or services, including
  digital content, tokens, and credits. Treat the resulting MaxVideoAI
  eligibility conclusion as an internal inference until OpenAI gives written
  clarification on the intended scope.
- **Anthropic Connectors Directory — do not submit.** Anthropic's current
  Directory Policy is the source of the existing internal policy gate for the
  intended AI-media-generation service. Reconsider only after a policy change
  or written Anthropic clarification covering that full workflow.

See the [distribution matrix](../../../docs/marketing/github-distribution-matrix.md)
for owners, required evidence, canonical backlinks, and review triggers. It is
the source of truth for distribution readiness; no directory record is claimed
until its target reaches `eligible_and_verified` with recorded exact-target
evidence.

## Sources checked on 2026-08-28

- [Official MCP Registry overview](https://modelcontextprotocol.io/registry/about),
  [terms](https://modelcontextprotocol.io/registry/terms-of-service), and
  [FAQ](https://modelcontextprotocol.io/registry/faq)
- [OpenAI plugin guidelines](https://developers.openai.com/plugins/app-guidelines)
  and [plugin submission](https://developers.openai.com/plugins/deploy/submission)
- [Anthropic directory submission guidance](https://claude.com/docs/connectors/building/submission)
  and [Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)
- [OpenAI MCP configuration guidance](https://learn.chatgpt.com/docs/extend/mcp)
  and [Anthropic custom-connector guidance](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
