# MaxVideoAI plugin v0.3.6

Checked: **2026-09-22**, Europe/Madrid. This record separates publication,
deployment, installation and host observations.

## Published package and Registry

The canonical [v0.3.6 release](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.6)
owns exactly two uploaded assets: the installable ZIP and its checksum. The
downloaded ZIP was byte-identical to the reviewed local candidate.

- Accepted source: `3f757a540d8cb2ba6835c4e38c9da6923ef545e1`, [PR #328](https://github.com/camgraphe/MaxVideoAi/pull/328).
- Successful Quality CI: [35664226228](https://github.com/camgraphe/MaxVideoAi/actions/runs/35664226228).
- Protected publication: [35665466502](https://github.com/camgraphe/MaxVideoAi/actions/runs/35665466502).
- Public commit/tag: `b6c39068243fa1327bfaca864a455bbd32a47bb3` / `v0.3.6`.
- Public tree: `fa4a5970d2c018bc7110ac76e480ee184e400fb6`.
- ZIP SHA-256: `efbe2bb3b43a6e3d5fc0b10ed72abf382d55e875da3f3ae95117c4a4743531e9`.

The official Registry record `com.maxvideoai/maxvideoai` was observed active and
latest at `0.3.6`. Existing namespace authentication was refreshed after the
short-lived publisher JWT expired; no namespace key or public proof changed.
The [application-repository release](https://github.com/camgraphe/MaxVideoAi/releases/tag/maxvideoai-plugin-v0.3.6)
is a source/discovery pointer with **zero uploaded assets**. Keep installable
assets in the dedicated repository. The cancelled 0.3.4 tag remains unchanged
and unpublished.

## Production checkpoint

Vercel deployment `dpl_ECZrzewKpFXcknVHnBkCmG17u71W` reached `READY`, with
production aliases assigned to the accepted source. The preceding deployment,
`dpl_BQshKYbQniAnmtyob1fEG4HS8D2H`, is the rollback reference for this checkpoint.
No capability flag, database migration, DNS or production secret changed.

The protected-resource metadata and EN/FR/ES MCP hubs returned HTTP 200. An
anonymous initialization still returned the discovery challenge with HTTP 401;
an intentionally invalid bearer additionally returned `error="invalid_token"`
and reconnection guidance. Both retained private/no-store cache policy.

An authenticated catalogue read before and after deployment returned identical
structured data for 39 models. Its text fallback decreased from 24,307 to 14,510
UTF-8 bytes (40.3%); parsing it reconstructed the complete structured result.
This is a measurement of that response, not total conversation-token savings
or a generation-latency benchmark.

## Local installation and real host checks

Codex CLI `0.155.0-alpha.9.2` exposed a stale marketplace source referencing a
deleted temporary build folder. The supported marketplace commands replaced
that source with the dedicated Git repository. Refreshing its old `v0.3.5` tag
after 0.3.6 publication deliberately kept 0.3.5. Changing the pinned Git ref
required removing the named marketplace source before re-adding it at `v0.3.6`.
Installation then reported 0.3.6 enabled; all 59 package-file checksums matched.
See the [client update guide](mcp-client-updates.md) for the verified commands.

Two fresh ephemeral Codex CLI tasks used `gpt-5.6-luna` with low reasoning and
the machine's existing plugin configuration:

- An implicit video-comparison request selected the planning skill and called
  `recommend_models` and `get_model_details`. Two detail calls first used the
  wrong key (`engineId`), then recovered with `id`. Recommendations also supplied
  audio/reference exclusions absent from the prompt. Discovery was observed;
  argument fidelity was **not** a complete pass.
- A text-only YouTube-title rewrite completed without any MCP invocation.

No generation, exact quote, media import, purchase or wallet spend was performed.
These are two actual-host observations, not a statistical selection rate or a
new full OAuth/paid-generation lifecycle certification. Claude Code, Claude
Desktop and ChatGPT web were not retested by this release checkpoint. Their
existing compatibility records remain independently dated.

Sanitized evidence lives in `output/audits/mcp-release-2026-09-22/`; raw CLI
logs, credentials, account information and private media are not included.
