# Assistant-directed creation examples — 2026-10-19

This change adds three finished productions to `/mcp` and the Codex guide in EN,
FR and ES. ChatGPT and Claude link to those Codex examples without inheriting
their execution evidence. No host certification, publication gate, pricing or
paid tool behavior changes.

The creative story is about what a visitor can direct in conversation. The
assistant generated source shots through MaxVideoAI MCP and also assembled the
film using its host's tools. The user did not operate an editing application.
These are edited productions, not raw outputs of a single video model or a
demonstration of a public MCP timeline/export tool.

## Provenance and claim boundaries

The production inventory was reviewed in the YouTube campaign reuse audit dated
2026-10-18. Its five cases contain 175 verified key pieces. Private job, account
and owner identifiers remain in that production workspace, not this repository.

| Case | Sources and assembly | Host evidence | Public boundary |
| --- | --- | --- | --- |
| MV-T03 / Main Character | Nano Banana 2 images and MiniMax H3 shots through MCP; assistant-selected shots, titles, edit and sound; separate Audio narration | Local Codex production context; host not serialized on every individual request | Fictional yellow backpack; not exact merchant-SKU fidelity. Six shots, 18 seconds. |
| MV-T20 / The Hat Stays | Wan 3 dialogue and MiniMax H3 action through MCP; assistant edit, captions and procedural foley | Explicit Codex desktop receipt | Mixed-model edited scene; approximately 27 seconds, not one continuous model result. |
| MV-T12 / The Daylight Afterparty | Kling 3 Omni Pro clips through MCP; image preparation used Nano Banana 2 and assistant ImageGen; assistant local music composition, edit and mix | Codex client trace and MCP job recovery evidence | Music composed with local tools, not supplied as a generation input and not evidence of a MaxVideoAI music-generation API. 30 seconds. |

The primary story names the possibility and result. Method details disclose the
relevant boundaries without recounting every production attempt. Historical
generation spend is not used as a current price. Original film masters remain in
the production workspace; the repository contains full-duration web delivery copies.

## Media delivery and attribution

`frontend/public/media/mcp/creations/` contains 1280×720 H.264/AAC delivery copies
and WebP posters extracted from the masters. Encoding: libx264 CRF 23, medium,
yuv420p, AAC 128k, faststart. No new AI generation was purchased for this change.
The adjacent [media manifest](mcp-creation-media.json) records source filenames,
source and delivery hashes, byte sizes and probes. Posters are 32–63 kB; films
are 3.6–4.3 MB each.

The shared manual `PublicVideoPlayer` supplies controls, retry and `preload="none"`.
No autoplay, new playback implementation, raw-output claim or original-download
CTA is introduced. These authored film delivery files do not change the automated
rendition catalogue or the critical homepage asset lifecycle.

Main Character uses **“Funkorama” by Kevin MacLeod**:
[source track](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100474),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
An excerpt was mixed under dialogue with fades and gain adjustments. This credit
and license are also linked beside the public film. The Hat Stays uses local
procedural foley; Daylight Afterparty uses an assistant-composed original track.

## Current capability checks

- `list_audio_capabilities` returned available `voice_only` on 2026-10-19; the
  published `audioGeneration` flag is enabled. Public FAQ and docs now describe
  voice-over with capability discovery, an exact quote and approval. No paid call
  was made during the audit. Public montage/timeline creation stays disabled.
- [Claude custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
  lists Free (one custom connector), Pro, Max and managed plans. Account wording
  was updated; existing MaxVideoAI host test dates were preserved.
- [ChatGPT custom MCP servers](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)
  remains the source for workspace eligibility. The existing connection-only
  checkpoint is now visible outside the setup disclosure. It is not a completed
  paid-generation certification.
- Live `robots.txt` allows OAI-SearchBot, ChatGPT-User, Claude-User and
  Claude-SearchBot; `llms.txt` already links the hub and host guides. Those files
  need no access-policy change. Search eligibility does not establish citations.
- Current MCP tool metadata already directs model discovery, exact quotes,
  approval and recovery. No server or plugin release changes were needed.

## Review and release scope

The user requested one PR, then handoff to the existing delivery task after the
implementation, browser checks and review. These media become website content
when that PR is merged and deployed; this work does not separately publish gallery
entries, YouTube videos, directory submissions or social posts. ChatGPT/Claude
end-to-end generation, Safari/iOS playback and measured citation lift are not
asserted by this change.
