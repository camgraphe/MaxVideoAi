# Task 4 report — bounded MCP montage preparation

## Status

Implemented `prepare_montage` as a disabled-by-default, read-only MCP tool. It resolves every clip through the existing OAuth-owned media resolver and returns only a contiguous frame edit plan with `status: "edit_plan"` and `persisted: false`.

No production calls, downloads, probes, generation/provider calls, exports, database writes, Studio persistence, URL creation, pushes, merges, or deployments were performed.

## Exact limits and contract

- Title: 1–80 trimmed characters.
- Settings: fps 24/25/30/60; aspect ratio 16:9/9:16/1:1/4:5/21:9; resolution 720p/1080p; audio mode preserve/mute.
- Clips: 2–12 ordered entries; canonical `ma_` plus 32 lowercase hex asset ID, nonnegative integer source-in frame, positive integer duration.
- Total: at most 180 seconds at the selected fps.
- Source validation: current OAuth owner, ready, nondeleted, supported video MIME, controlled storage origin, measured duration present, and trim end no later than `floor(durationSec * fps)`.
- Repeated assets are supported; output clip IDs are unique and timeline starts are contiguous.
- Output excludes internal IDs, storage/source URLs, raw metadata, provider data, and Studio URLs. Semantic order is explicitly caller supplied rather than inferred through visual analysis.

## Validation

Passed:

```bash
NODE_PATH="$PWD/frontend/node_modules" node node_modules/tsx/dist/cli.mjs --tsconfig frontend/tsconfig.json --test tests/mcp-montage-plan.test.ts tests/mcp-montage-tools-contract.test.ts tests/mcp-reference-ownership.test.ts tests/mcp-staging-enablement.test.ts tests/mcp-default-services-config.test.ts tests/mcp-instructions.test.ts tests/mcp-tools-contract.test.ts tests/mcp-list-media.test.ts
```

Result: 41 passed, 0 failed.

```bash
./node_modules/.bin/eslint src/server/agent-api/montage-plan.ts src/server/mcp/tools/prepare-montage.ts src/server/mcp/server.ts src/server/mcp/instructions.ts src/server/mcp/http-handler.ts src/server/mcp/tool-input-schemas.ts --ext .ts
```

Result: passed from `frontend/`.

```bash
npm run lint:exposure
git diff --check
```

Result: both passed.

Typecheck attempted with:

```bash
./frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```

The repository-wide check is blocked by pre-existing errors in the other-owned untracked `frontend/.tmp/experience-review/Fixture.tsx` SWR fixture. No owned montage file appeared in the diagnostics. `npm --prefix frontend run typecheck` was also attempted, but the package has no `typecheck` script.

## Remaining boundary

This is an edit plan only. Opening an editable montage still requires a later integration branch where Studio and MCP coexist, with transactional create-only persistence and public-to-internal asset ID adaptation.
