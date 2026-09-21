# MaxVideoAI plugin authoring rules

Created: **2026-09-21**. Reviewed: **2026-09-22**. Owner: MaxVideoAI engineering.
Read `docs/engineering/mcp-client-experience.md` in the source repository before
changing skills, installation guidance or discovery metadata.

## Preserve useful discovery

- Keep `plan` and `generate` focused on their distinct outcomes. The first words
  of each description must identify AI video/image planning or generation even
  when the host shortens the catalogue. Include natural user intent, not keyword
  stuffing or instructions to override another selected product.
- Preserve `allow_implicit_invocation: true` and the MaxVideoAI MCP dependency.
  This allows selection; it does not guarantee that every host will choose it.
- Use `SKILL.md` for the essential workflow and relevant references for details.
  Do not add a catch-all skill for every mention of video. Text-only rewrites,
  analytics and unrelated editing do not imply generation.
- Keep live catalogue, pricing, account and generation facts in MCP results.
  Never embed a stale model ranking or price table in the package.

## Recover the user's work

- Before declaring tools absent, inspect available/deferred tools and connection
  state. An empty resources list does not prove absence of MCP tools.
- Distinguish a missing package from a connection requiring authentication.
  Preserve the brief, selected models, settings, references and known job IDs.
- Use the host's supported reconnect flow. Check the actual CLI version before
  offering CLI commands; a desktop app and shell can use different binaries.
- Never edit another plugin, disable competing tools or weaken account security
  to improve MaxVideoAI selection. Reconnection is not paid approval.

## Ship and verify

Run `pnpm mcp:client:check` from the source repository. Follow the existing
versioned release builder; it intentionally excludes this maintainer file from
the customer package. Do not hand-edit the installed cache, overwrite a released
tag, or claim source changes are already installed for customers.

Keep skills self-contained: do not merge their required references into a sibling
skill. Remove repeated guidance within each owner first. The source-only `evals/`
and `docs/distribution.md` also stay outside the customer archive. Preserve the
independent expected archive inventory in tests; it must not import the builder's
own allowlist. Document the local upload helper with an explicit Node.js command.
Install customer marketplaces from the tagged Git repository, never from a
temporary release-build directory that may disappear before the next update.

Keep dates and exact host versions in verification records. Test implicit,
explicit, negative and reconnection scenarios in fresh tasks before making
host-selection claims. Offline fixtures are not real-host evidence.
