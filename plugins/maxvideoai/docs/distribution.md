# Distribution and installation status

Checked: **2026-10-05**. Directory policy observations retain their separate dates below.

Packaging boundary reviewed **2026-09-22**: this is a source-maintainer document,
excluded from the customer archive along with `evals/` and `AGENTS.md`. The public
archive includes the individual host installation guides. Its exact inventory
is owned by the release builder and checked independently by the bundle test.

MaxVideoAI's distributable MCP metadata names the protocol-generic endpoint
`https://api.maxvideoai.com/mcp`. This document distinguishes direct setup from
directory distribution so that an installation path is never mistaken for a
platform approval or a directory record.

## Published release — 2026-10-05

The protected publisher completed source `a833d985a81f9d523e08917674a01f1e220337b1`
to public commit `67dfbedad6e32377287b55ba005296e73206b23a`.
[Canonical release v0.3.7](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.7)
contains the ZIP and checksum. Downloaded bytes match the qualified deterministic
archive, SHA-256 `f43ae14a709c97ef2cb07f4955ae52dc6792ec10e4ab86eeddad1fc67f4a6ff4`.
The application-repository release is a pointer, with no duplicate assets.
The official Registry record is active/latest at 0.3.7. Website installation
copy now pins the published `v0.3.7` in the source follow-up; its production
delivery remains a separate PR and CI gate. See the
[publication checkpoint](../../../docs/operations/mcp-distribution-publication-2026-10-05.md).

## Historical prepared release candidate — 2026-10-04

The observations in this section preceded the October 5 publication above.

Source package **0.3.7** is prepared locally and has not been published. A fresh
read-only check found public tags/releases through `v0.3.6`, source tags through
`maxvideoai-plugin-v0.3.6`, and official Registry versions 0.3.3, 0.3.5 and 0.3.6;
0.3.6 remains active/latest. No 0.3.7 tag, release or Registry record was found.

The package manifests, `server.json`, `VERSION` and its installation examples
move together to 0.3.7. The public website installation constant separately pins
the already published `v0.3.6` in `camgraphe/maxvideoai-plugin`. Keep that pin until
the immutable 0.3.7 focused repository tag, release and package checksums have
been published and read back successfully. The application repository's
`maxvideoai-plugin-v0.3.7` tag identifies reviewed source; it is not the customer
marketplace repository. Registry publication and server deployment remain
separate actions. Recheck version availability immediately before publication.

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

- **Official MCP Registry — active at `0.3.7`.** The official API record for
  [`com.maxvideoai/maxvideoai`](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.maxvideoai%2Fmaxvideoai)
  is active. This protocol registry publication is not an OpenAI, Anthropic, or
  other host-directory listing and does not prove host compatibility.
  The version and production endpoint were rechecked on **2026-10-05**; this is a dated observation. Check the exact
  public record again before release. Policy review dates below are
  separate from this registry check.
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
