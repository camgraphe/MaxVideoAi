# MCP marketing asset provenance

Verified on 2026-07-14. This record separates official partner artwork, repository-reused artwork, and MaxVideoAI-owned proof media. Checksums cover the exact committed bytes.

## Partner marks

### Claude

The Claude Spark mark was retrieved from Anthropic's official [press kit](https://www.anthropic.com/press-kit). That link resolved to Anthropic's media archive at `https://www-cdn.anthropic.com/ae59ca4ca194dac9c9dc3bc78c5829468cb0e8af.zip` (archive SHA-256 `c68ac92df86c825f95177e24016fcc9a8863a3fd4ca344fe6f0700b2c1e07151`). The exact archive member is `Anthropic media resources/Anthropic logos/Claude logos/3 Claude Spark/SVG/Claude Spark - Clay.svg`.

The archive supplied one Clay-colored Spark SVG. Its path geometry and bytes were not edited. The same exact file is used for light and dark themes on a neutral theme-safe tile.

### OpenAI

The two compact monochrome OpenAI marks already existed in this repository and were introduced by commit `1d15c9f9`. Their original download artifact is not recoverable from repository history, so this record does not claim a fresh first-party download. They are reused under the current [OpenAI brand guidelines](https://openai.com/brand/) and should be rechecked against those guidelines before redistribution.

## Result media

The source is the public Google Veo 3.1 marketing render registered by MaxVideoAI in `frontend/server/engine-demos.ts`:

- Source: `https://media.maxvideoai.com/renders/marketing/f9711b1e-53d5-4a1d-9adf-8186784538e3.mp4`
- Source SHA-256: `5db66cfa848a021afaabe3a0a47a2a44643980966ef5aa8a055fe438cf678771`
- Verified source properties: 8 seconds, 1280×720, H.264 video with AAC audio
- Committed MP4: video stream copied without audio, source metadata removed, fast-start enabled
- Committed poster: frame at 0.5 seconds, encoded as WebP with source metadata removed

This provenance supports only the label `Real MaxVideoAI output`. It does not establish that the render originated from an MCP session.

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
      "retrievedAt": "2026-07-14",
      "usageNote": "Use the unchanged official Clay Spark on a neutral theme-safe tile; the same bytes serve both themes.",
      "sha256": "6d53db4be375e899c937c26cf16684a80d6e869b1928d72b37748bef2560e219"
    },
    {
      "path": "frontend/public/brand/partners/anthropic/claude-mark-dark.svg",
      "officialOwner": "Anthropic PBC",
      "origin": "official-anthropic-press-kit",
      "sourceUrl": "https://www.anthropic.com/press-kit",
      "sourceArchivePath": "Anthropic media resources/Anthropic logos/Claude logos/3 Claude Spark/SVG/Claude Spark - Clay.svg",
      "retrievedAt": "2026-07-14",
      "usageNote": "Use the unchanged official Clay Spark on a neutral theme-safe tile; the same bytes serve both themes.",
      "sha256": "6d53db4be375e899c937c26cf16684a80d6e869b1928d72b37748bef2560e219"
    },
    {
      "path": "frontend/public/brand/partners/openai/openai-mark-light.svg",
      "officialOwner": "OpenAI",
      "origin": "repository-reuse",
      "sourceUrl": "https://openai.com/brand/",
      "sourceArchivePath": null,
      "retrievedAt": "2026-07-14",
      "usageNote": "Reuse the existing compact monochrome repository mark and follow OpenAI's current partner-brand guidance.",
      "sha256": "a8bae4b4f9561295cfb4d7a619ca837b1e41b6a6a634ed29b12bdee85b804bd6"
    },
    {
      "path": "frontend/public/brand/partners/openai/openai-mark-dark.svg",
      "officialOwner": "OpenAI",
      "origin": "repository-reuse",
      "sourceUrl": "https://openai.com/brand/",
      "sourceArchivePath": null,
      "retrievedAt": "2026-07-14",
      "usageNote": "Reuse the existing compact monochrome repository mark and follow OpenAI's current partner-brand guidance.",
      "sha256": "5cfb761d9532e49cf26008a287df7a781647aa9cf6044b7c62f4f626fb74f850"
    },
    {
      "path": "frontend/public/mcp/mcp-result.mp4",
      "officialOwner": "MaxVideoAI",
      "origin": "product-owned-production-registry",
      "sourceUrl": "https://media.maxvideoai.com/renders/marketing/f9711b1e-53d5-4a1d-9adf-8186784538e3.mp4",
      "sourceArchivePath": null,
      "retrievedAt": "2026-07-14",
      "usageNote": "Muted metadata-sanitized local derivative for the real-output fallback; do not describe it as MCP-originated.",
      "sha256": "df66302c8b34f3a79dcc39d906b69ed30184a8299e179e116ab600adb69436f7"
    },
    {
      "path": "frontend/public/mcp/mcp-result-poster.webp",
      "officialOwner": "MaxVideoAI",
      "origin": "product-owned-production-registry-derived-poster",
      "sourceUrl": "https://media.maxvideoai.com/renders/marketing/f9711b1e-53d5-4a1d-9adf-8186784538e3.mp4",
      "sourceArchivePath": null,
      "retrievedAt": "2026-07-14",
      "usageNote": "Metadata-sanitized WebP frame from the registered result, used only with the real-output fallback label.",
      "sha256": "648f1e34cef686151898067d96880f5959d3f37a5b997477a0f97a7783a35634"
    }
  ]
}
```
