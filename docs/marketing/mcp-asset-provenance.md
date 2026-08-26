# MCP marketing asset provenance

Verified on 2026-08-26. Partner marks and the Claude-specific controlled host capture satisfy their distinct publication bars. Checksums in the manifest cover the exact committed bytes.

Marketing usage keeps both marks unchanged and at equal optical size, while MaxVideoAI remains the primary brand.
The surrounding copy describes compatibility only; it never claims partnership, sponsorship, certification, or
endorsement. Visible ChatGPT and Claude labels carry the prospect and SEO meaning, so decorative marks keep empty alt
text rather than repeating keywords.

## Partner marks

### Claude

The Claude Spark mark was obtained from Anthropic's official [press kit](https://www.anthropic.com/press-kit). The official link resolved to Anthropic's media archive at `https://www-cdn.anthropic.com/ae59ca4ca194dac9c9dc3bc78c5829468cb0e8af.zip`.

Independent checksum pins:

- Official archive SHA-256: `c68ac92df86c825f95177e24016fcc9a8863a3fd4ca344fe6f0700b2c1e07151`
- Archive member: `Anthropic media resources/Anthropic logos/Claude logos/3 Claude Spark/SVG/Claude Spark - Clay.svg`
- Exact member SHA-256: `6d53db4be375e899c937c26cf16684a80d6e869b1928d72b37748bef2560e219`

The archive supplied one Clay-colored Spark SVG. Its bytes, path geometry, and color were not edited. The same exact file is used for both theme paths on a neutral theme-safe tile. Tests pin the independently verified archive and member hashes rather than trusting mutable manifest values alone.

### OpenAI

The compact monochrome OpenAI marks already existed in this repository and were introduced by commit `1d15c9f9`. Their original retrieval date and download artifact are not recoverable from repository history. The files were verified on 2026-08-26 against the repository copy and the current [OpenAI brand guidelines](https://openai.com/brand/); the manifest therefore records `verifiedAt`, not an invented retrieval date.

## Rejected result candidate

The public registry entry `https://media.maxvideoai.com/renders/marketing/f9711b1e-53d5-4a1d-9adf-8186784538e3.mp4` was considered as a result candidate and rejected. Registry or CDN presence alone does not establish who generated a video or tie it to a MaxVideoAI job or audit record.

The candidate container (SHA-256 `5db66cfa848a021afaabe3a0a47a2a44643980966ef5aa8a055fe438cf678771`) and the public provider example `https://storage.googleapis.com/falserverless/example_outputs/veo3-i2v-output.mp4` (SHA-256 `6430e711dca4f2e1d8b7c6e8cf333d444bebabf48ef4662e196554270bc29b19`) contain the same encoded streams:

- Video stream SHA-256: `a70320cdd31f395c3081cb1557cf5ef2958332330234d2d8bb6e650305a56449`
- Audio stream SHA-256: `f2cc3c3cdaf1de1d028fe5aaf09c434a5c2b64d55413a343852e9ea04ce6e135`

The previously derived local MP4 (`df66302c8b34f3a79dcc39d906b69ed30184a8299e179e116ab600adb69436f7`) and poster (`648f1e34cef686151898067d96880f5959d3f37a5b997477a0f97a7783a35634`) were removed. None of these rejected hashes is a publishable asset or proof record.

## Claude inline host capture

`frontend/public/media/mcp/claude-inline-video-proof.jpg` preserves the exact JPEG bytes captured from Claude Desktop 1.37937.1 on macOS 26.5.1. A controlled staging session exercised native playback, the MaxVideoAI library state, and the first-party CTA. The capture was reviewed for visible account identifiers and approved by the MaxVideoAI owner for marketing use.

This image is used nominatively to show the tested Claude surface. It does not imply Anthropic partnership or endorsement, cannot support a ChatGPT rendering claim, and does not satisfy the separate job-backed MaxVideoAI result-proof gate. The visible `$0.95` is described only as the historical capture amount.

<!-- mcp-asset-provenance:v1 -->
```json
{
  "version": 1,
  "assets": [
    {
      "path": "frontend/public/brand/partners/anthropic/claude-mark-light.svg",
      "officialOwner": "Anthropic PBC",
      "origin": "official-anthropic-press-kit",
      "sourceUrl": "https://www.anthropic.com/press-kit",
      "sourceArchivePath": "Anthropic media resources/Anthropic logos/Claude logos/3 Claude Spark/SVG/Claude Spark - Clay.svg",
      "sourceArchiveSha256": "c68ac92df86c825f95177e24016fcc9a8863a3fd4ca344fe6f0700b2c1e07151",
      "verifiedAt": "2026-08-26",
      "usageNote": "Use the unchanged official Clay Spark on a neutral theme-safe tile; the same bytes serve both themes.",
      "sha256": "6d53db4be375e899c937c26cf16684a80d6e869b1928d72b37748bef2560e219"
    },
    {
      "path": "frontend/public/brand/partners/anthropic/claude-mark-dark.svg",
      "officialOwner": "Anthropic PBC",
      "origin": "official-anthropic-press-kit",
      "sourceUrl": "https://www.anthropic.com/press-kit",
      "sourceArchivePath": "Anthropic media resources/Anthropic logos/Claude logos/3 Claude Spark/SVG/Claude Spark - Clay.svg",
      "sourceArchiveSha256": "c68ac92df86c825f95177e24016fcc9a8863a3fd4ca344fe6f0700b2c1e07151",
      "verifiedAt": "2026-08-26",
      "usageNote": "Use the unchanged official Clay Spark on a neutral theme-safe tile; the same bytes serve both themes.",
      "sha256": "6d53db4be375e899c937c26cf16684a80d6e869b1928d72b37748bef2560e219"
    },
    {
      "path": "frontend/public/brand/partners/openai/openai-mark-light.svg",
      "officialOwner": "OpenAI",
      "origin": "repository-reuse",
      "sourceUrl": "https://openai.com/brand/",
      "sourceArchivePath": null,
      "verifiedAt": "2026-08-26",
      "usageNote": "Reuse the existing compact monochrome repository mark and follow OpenAI's current partner-brand guidance.",
      "sha256": "a8bae4b4f9561295cfb4d7a619ca837b1e41b6a6a634ed29b12bdee85b804bd6"
    },
    {
      "path": "frontend/public/brand/partners/openai/openai-mark-dark.svg",
      "officialOwner": "OpenAI",
      "origin": "repository-reuse",
      "sourceUrl": "https://openai.com/brand/",
      "sourceArchivePath": null,
      "verifiedAt": "2026-08-26",
      "usageNote": "Reuse the existing compact monochrome repository mark and follow OpenAI's current partner-brand guidance.",
      "sha256": "5cfb761d9532e49cf26008a287df7a781647aa9cf6044b7c62f4f626fb74f850"
    },
    {
      "path": "frontend/public/media/mcp/claude-inline-video-proof.jpg",
      "officialOwner": "MaxVideoAI controlled test",
      "origin": "controlled-claude-desktop-capture",
      "sourceUrl": "https://maxvideoai-mcp-staging.vercel.app/mcp",
      "sourceArchivePath": null,
      "verifiedAt": "2026-08-26",
      "usageNote": "Claude-specific host rendering evidence with historical-price qualification; no partnership, endorsement, ChatGPT, or owned-result-proof claim.",
      "sha256": "2f54400a0287e7930295718beabb7c51b93cc927eb4abdd2dd9108d268a0780e"
    }
  ]
}
```
