# Changelog

## 0.3.2 — 2026-08-28

- Publish proof-led package and discovery metadata with reviewed setup guidance
  for Claude, ChatGPT, Codex, and compatible MCP clients.
- Keep the shared OpenAI plugin journey qualified by directory approval, with a
  developer-mode MCP fallback and OAuth on first use.
- Strengthen deterministic mirror publication with review-gated drift checks and
  adversarial release, content, and asset validation.

## 0.3.1 — 2026-08-28

- Document the namespaced Codex skill invocations as `$maxvideoai:plan` and
  `$maxvideoai:generate` so explicit skill routing works in a fresh session.

## 0.3.0 — 2026-08-28

- Import private reference images and videos into the MaxVideoAI media library
  without publishing them on a public URL.
- Add the reviewed `import_reference_files` workflow and local helper for Codex
  and Claude Code, with multi-file support and returned library asset IDs.
- Keep the browser upload handoff as a manual fallback for hosts that cannot pass
  private files directly.
- Preserve exact quotes and explicit approval before every paid generation.

## 0.2.0 — 2026-08-27

- Add separate `plan` and `generate` workflow skills for Codex and Claude Code.
- Keep model availability, capabilities, and pricing live through MaxVideoAI tools.
- Clarify that connection is free, a MaxVideoAI account is required, and paid
  generation always waits for an exact quote and explicit approval.
- Add deterministic public release packaging with per-file checksums.

## 0.1.0 — 2026-08-24

- Initial MaxVideoAI remote MCP connector package.
