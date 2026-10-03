# MCP server maintenance

Reviewed 2026-10-03. Read `docs/engineering/mcp-client-experience.md` before editing
instructions, discovery metadata or workflow guidance.

- Keep global instructions and each tool description within 2,000 UTF-8 bytes.
  Cover every capability combination. Put exact quote, explicit approval and
  one-attempt rules in the first 1,000 bytes when generation is active.
- Tool descriptors own operation-specific prerequisites and recovery. Move their
  runtime metadata assertions with the rule; never delete a constraint to fit.
- Preserve gate, schema, account ownership and billing boundaries. Live results
  own catalogs/prices; editorial preference is not a measured quality ranking.
- An interrupted call requires status recovery, never automatic paid replacement.
  A refund or reconnect does not restore authorization. Only use returned URLs.
- Run `pnpm mcp:client:check` and affected business suites. Offline assertions are
  not real-host selection evidence. Deployment requires its own release workflow.
