# MaxVideoAI plugin maintenance

Reviewed 2026-10-03. Read `docs/engineering/mcp-client-experience.md` in the source
repository before changing skills or discovery guidance.

- Keep `plan` and `generate` distinct, self-contained and driven by live facts.
  Preserve implicit invocation and the MaxVideoAI dependency. Do not add static
  prices, model rankings, a catch-all video skill or client-priority instructions.
- Distinguish discovery from authentication. Inspect deferred tools before saying
  they are absent; preserve the user's brief and known job IDs during reconnect.
- Required references resolve to owned assets, including authorized host imports.
  An attachment is an import source, not an already imported generation reference.
- Run `pnpm mcp:client:check`. Publish through the existing immutable versioned
  builder; do not edit installed caches or overwrite a tag. This maintainer file
  remains outside the customer archive. Never claim a local edit is already live.
