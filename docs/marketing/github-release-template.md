# MaxVideoAI GitHub release template

Use this only for a reviewed, releasable tag. Replace every bracketed field with current evidence; remove a section rather than guessing.

Release v0.3.0 and release v0.3.1 are public in the focused plugin repository. The checked-in 0.3.2 package remains a closed, unpublished candidate until its own gate is complete; this reusable template does not change that status.

## Outcome

**Short answer:** [State the production or package outcome in one evidence-qualified sentence.]

![Descriptive alt text for the reviewed release visual]([current-release-visual-path])

*Current MaxVideoAI product proof; it does not prove native host installation or end-to-end host validation.*

## What changed

- [Reviewed package, documentation, or safety change.]
- [Link to the source diff or issue.]

## Who benefits

[Name the producer, developer, or administrator outcome. Do not imply every host or account is supported.]

## Current visual

**Asset:** `[current-release-visual-path]`.

**Evidence boundary:** [State exactly what the visual proves and what it does not prove.]

## Install or update

Use the reviewed release tag, not a guessed version:

```sh
codex plugin marketplace add camgraphe/MaxVideoAi --ref <reviewed-release-tag>
codex plugin add maxvideoai@maxvideoai
```

Then start a new Codex task and use `$maxvideoai:plan` for a no-spend comparison. Use `$maxvideoai:generate` only when you are ready to prepare a concrete request and review its exact quote. Command availability varies by host build; check the [Codex guide](../../plugins/maxvideoai/docs/codex.md) for the current boundary.

[Plan the connected workflow](https://maxvideoai.com/mcp?utm_source=github&utm_medium=release&utm_campaign=assistant_video_plugin_0_3_2&utm_content=release_connect) only after the reviewed release is published; this template itself does not announce a release.

## Compatibility

[List only a recorded client/version and the cited evidence. State “unverified” where evidence is absent. Protocol support, a package install, and a native-host generation are separate claims.]

## Safety boundary

Planning and project budgets do not authorize paid work. A prepared request returns an exact quote; only explicit approval authorizes one paid attempt. Recover an accepted job before considering another request. Do not include tokens, passwords, private media, or account data in release evidence.

## Full changelog

- [Added]
- [Changed]
- [Fixed]
- [Security or documentation note]

## Sources and publication gate

- Reviewed source tag: [current-version source-tag URL]
- Checksum asset: [current-version checksum URL and SHA-256]
- [Current MCP documentation](https://maxvideoai.com/mcp?utm_source=github&utm_medium=release&utm_campaign=assistant_video_plugin_0_3_2&utm_content=release_docs)
- Publication gate: source tag, checksums, clean install, current visual provenance, compatibility wording, safety boundary, and support links reviewed by the release owner.
