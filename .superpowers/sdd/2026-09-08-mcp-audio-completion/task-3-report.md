# MCP Audio Task 3 — public tools and original result

Task 3 publishes thin Audio MCP adapters while retaining a default-closed production kill switch. `audioGeneration` is effective only together with `paidGeneration`; transport tests explicitly override both for qualification. The adapters expose exact schemas and annotations for capability discovery, preparation and one confirmed attempt, and preserve the authenticated OAuth user/client principal.

Owned status and recent readers now recognize `surface: audio`, return the stable original HTTPS media with its exact persisted MIME type and decimal measured duration, and point recovery to `/app/audio`. Completion projects one idempotent original `job_output`, using the MIME measured from persisted bytes and retaining the exact duration in metadata.

The immutable generation-result v5 App adds a compact native manual Audio player without autoplay. Pending and failed states have no media source. Completed results offer signed download, safe settings reuse and the owned workspace destination. Legacy v1-v4 resources still serve the v4 document. Browser fixtures cover desktop light/dark, 390-pixel mobile layout and keyboard focus; the accepted capture files are `/tmp/maxvideoai-mcp-audio-v5-reviewed3-light.png`, `/tmp/maxvideoai-mcp-audio-v5-reviewed3-dark.png` and `/tmp/maxvideoai-mcp-audio-v5-reviewed3-mobile.png`.

The composed test command runs from the repository root with the frontend dependency tree:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/audio-creative-contract.test.ts \
  tests/audio-reserved-execution-postgres.test.ts \
  tests/generation-status-service.test.ts \
  tests/mcp-audio-normalization.test.ts \
  tests/mcp-audio-output-postgres.test.ts \
  tests/mcp-audio-public-tools.test.ts \
  tests/mcp-audio-services-architecture.test.ts \
  tests/mcp-audio-services-postgres.test.ts \
  tests/mcp-audio-services.test.ts \
  tests/mcp-config.test.ts \
  tests/mcp-generation-recovery-tools.test.ts \
  tests/mcp-inline-media-app.test.ts \
  tests/mcp-instructions.test.ts \
  tests/mcp-staging-enablement.test.ts \
  tests/mcp-transport-contract.test.ts \
  tests/media-library-contract.test.ts \
  tests/recent-generations-postgres.test.ts \
  tests/recent-generations-service.test.ts
```

It passed 159 tests with no failures or skips, including Task 2 services, disposable PostgreSQL quote/reservation/output/recent tests, transport, owned recovery, signed Audio download, result App DOM and existing media regressions.

No paid call, upload, provider network call, production mutation or deployment was used. The synchronous crash limitation from Task 2 remains: a durable claimed job is observable but is not permission to resubmit. Production publication stays false until separate product/provider qualification.
