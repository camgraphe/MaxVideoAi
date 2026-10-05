# MCP distribution publication — 2026-10-05

Owner-authorized follow-up to the October 4 preparation and October 5 read-only
audit. Package, registry, deployed service, saved workflows and client installation
remain separate delivery surfaces.

## Published package and Registry

- Immutable source tag `maxvideoai-plugin-v0.3.7` resolves to
  `a833d985a81f9d523e08917674a01f1e220337b1`.
- [Protected publisher run 37341472219](https://github.com/camgraphe/MaxVideoAi/actions/runs/37341472219),
  attempt 2, succeeded on October 5 at 20:09:07 UTC. Attempt 1 failed to acquire
  a hosted runner before any publishing step. The scoped destination credential
  was renewed with unchanged permissions; no broad-token or CI bypass was used.
- The complete prepared 13-path diff matched the qualified local patch before
  fresh environment approval. The public commit is
  `67dfbedad6e32377287b55ba005296e73206b23a`, tree
  `435746f2ba58e215245c636118324c47c553c336`.
- [Canonical v0.3.7](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.7)
  was published at 20:09:03 UTC. The ZIP is 1,239,790 bytes with 60 entries,
  SHA-256 `f43ae14a709c97ef2cb07f4955ae52dc6792ec10e4ab86eeddad1fc67f4a6ff4`.
  Downloaded bytes equal the qualified archive and match the attached checksum.
- The [source release pointer](https://github.com/camgraphe/MaxVideoAi/releases/tag/maxvideoai-plugin-v0.3.7)
  links to the canonical assets without uploading duplicate archives.
- The [official Registry latest record](https://registry.modelcontextprotocol.io/v0.1/servers/com.maxvideoai%2Fmaxvideoai/versions/latest)
  reports active/latest 0.3.7, published at 20:10:53 UTC. Returned server metadata
  exactly equals authored `plugins/maxvideoai/server.json`. Existing domain
  authentication was refreshed with the same matching key and namespace proof.

## Existing Codex installation

Codex CLI 0.156.0 updated only the named MaxVideoAI marketplace from canonical
tag `v0.3.6` to `v0.3.7`, using supported remove/add/install commands. The plugin
is installed and enabled at 0.3.7; all 60 cached package files match the verified
public ZIP. No cache was edited and no account authorization was revoked.

A read-only call through the existing connected MCP returned 38 models without
error or media generation. This proves the existing connection still works;
it does not establish fresh-task discovery, new OAuth lifecycle certification,
automatic updates for other installations or compatibility with every host.

## Other distribution surfaces and remaining gates

- ClawHub 1.0.1 was separately published on October 4. The October 5 audit found
  both authored instruction files identical to current source. Its independent
  version series does not need another upload just to match plugin numbering.
- The qualified 21-node n8n recovery workflow was uploaded to existing template
  19591. The Creator Portal shows `Pending` / `Under review`, dated October 5,
  and disables the next-template action. Approval and public-payload parity remain
  pending; its API still serves the historical 20-node payload. The two other
  candidates remain unsubmitted. See the
  [n8n submission checkpoint](../marketing/mcp-directory-submissions.md#n8n-update-submission--2026-10-05).
- Glama's public page showed ownership verified, Healthy and 15 tools on October 5.
  This is third-party evidence, not new exact-host certification.
- MCPBeat and mcpdirectory.dev still showed 0.3.6 in the check immediately before
  upstream publication. Downstream ingestion must be observed before claiming
  that their displayed version has advanced. Stable endpoint and repository
  links remain correct; OAuth must not be weakened for anonymous health badges.
- Website installation instructions now select public `v0.3.7` in the source
  follow-up. The n8n review state and EN/FR/ES copy are in
  [PR391](https://github.com/camgraphe/MaxVideoAi/pull/391), which must include
  coordinated Studio PR390 and pass latest Quality CI before normal Git deployment.
  The source-only distribution checkpoint stays outside the immutable archive.
- Curated host-directory restrictions and untested-host evidence retain their
  existing states. No new directory approval is inferred from this publication.
