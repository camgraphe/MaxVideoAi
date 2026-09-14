# Distribution and installation status

Checked: **2026-09-14**.

MaxVideoAI's distributable MCP metadata names the protocol-generic endpoint
`https://api.maxvideoai.com/mcp`. This document distinguishes direct setup from
directory distribution so that an installation path is never mistaken for a
platform approval or a directory record.

## Direct installation

Use the setup material on [MaxVideoAI's MCP page](https://maxvideoai.com/mcp)
for the canonical endpoint, account requirements, and current support links.
Direct setup documentation may state the available protocol and configuration
path without treating it as exact-host compatibility evidence. A direct URL is
not a directory record; named compatibility still requires a clean-account
production check of installation, consent, tool behavior, revocation, recovery,
and support reproduction.

### Direct ChatGPT configuration

The public MaxVideoAI ChatGPT guide documents the available developer-mode MCP
setup at `https://api.maxvideoai.com/mcp`, separately from the ChatGPT/OpenAI
directory. The [OpenAI MCP guide](https://learn.chatgpt.com/docs/extend/mcp)
documents that configuration surface, but exact-host evidence remains
`not-run` for MaxVideoAI. Direct setup availability does not prove ChatGPT host
compatibility; MCP Engineering must still record the client/version, consent,
tool behavior, revocation, recovery, and support reproduction before upgrading
that evidence state.

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

- **Official MCP Registry — active at `0.3.3`.** The official API record for
  [`com.maxvideoai/maxvideoai`](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.maxvideoai%2Fmaxvideoai)
  is active. This protocol registry publication is not an OpenAI, Anthropic, or
  other host-directory listing and does not prove host compatibility.
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

## Sources checked on 2026-09-14

- [Official MCP Registry overview](https://modelcontextprotocol.io/registry/about),
  [terms](https://modelcontextprotocol.io/registry/terms-of-service), and
  [FAQ](https://modelcontextprotocol.io/registry/faq)
- [OpenAI plugin guidelines](https://developers.openai.com/plugins/app-guidelines)
  and [plugin submission](https://developers.openai.com/plugins/deploy/submission)
- [Anthropic directory submission guidance](https://claude.com/docs/connectors/building/submission)
  and [Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)
- [OpenAI MCP configuration guidance](https://learn.chatgpt.com/docs/extend/mcp)
  and [Anthropic custom-connector guidance](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
