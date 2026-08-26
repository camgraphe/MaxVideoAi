# MaxVideoAI MCP Inline Media App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a completed, owned MaxVideoAI video or image directly inside compatible ChatGPT and Claude conversations while preserving the current universal fallback.

**Architecture:** Add a decoupled read-only `present_generation` render tool that reuses the existing generation-status service and returns the same safe recovery DTO plus resource links. Register one versioned MCP Apps HTML resource whose inline player renders from `structuredContent`; all existing data and mutation tools stay unchanged.

**Tech Stack:** TypeScript, Next.js server modules, `@modelcontextprotocol/sdk` 1.29.0, MCP Apps HTML resource, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-26-mcp-inline-media-app-design.md`

## Global Constraints

- Keep OAuth ownership checks in the existing `getGenerationStatus` service.
- Do not attach UI templates to polling, quote, confirmation, or generation tools.
- Preserve text and `resource_link` fallbacks for hosts without MCP Apps UI support.
- Never publish an inline-playback compatibility claim before a real host test.
- Support light and dark host themes and keep the media player as the primary visual.

---

### Task 1: Lock the MCP Apps contract

**Files:**
- Create: `tests/mcp-inline-media-app.test.ts`
- Modify: `tests/mcp-tools-contract.test.ts`

**Interfaces:**
- Consumes: `createMaxVideoAiMcpServer(principal, services, { paidGeneration: true })`
- Produces: a `present_generation` tool descriptor linked to `ui://maxvideoai/generation-result-v1.html` and a readable HTML resource.

- [ ] **Step 1: Write the failing contract tests**

Assert that the paid profile exposes `present_generation` as read-only, that its descriptor includes `_meta.ui.resourceUri` and the OpenAI compatibility alias, that the template resource uses `text/html;profile=mcp-app`, and that the HTML contains a native `<video>` player plus light/dark styles.

- [ ] **Step 2: Run the tests to verify RED**

Run: `node --import tsx --test tests/mcp-inline-media-app.test.ts tests/mcp-tools-contract.test.ts`

Expected: FAIL because `present_generation` and its resource are not registered.

- [ ] **Step 3: Keep tests focused on public behavior**

Use the in-memory MCP client to call `listTools`, `listResources`, `readResource`, and `callTool`; do not assert private implementation function names.

### Task 2: Implement the presentation resource and tool

**Files:**
- Create: `frontend/src/server/mcp/generation-result-app.ts`
- Create: `frontend/src/server/mcp/tools/present-generation.ts`
- Modify: `frontend/src/server/mcp/server.ts`

**Interfaces:**
- Consumes: `services.getGenerationStatus(input, principal)` and `buildGenerationResourceLinks(recovery)`.
- Produces: `registerGenerationResultApp(server)` and `registerPresentGenerationTool(server, principal, services)`.

- [ ] **Step 1: Register the versioned UI resource**

Return one HTML document with `mimeType: "text/html;profile=mcp-app"`, `_meta.ui.prefersBorder`, exact CSP origin lists, and the matching OpenAI compatibility metadata.

- [ ] **Step 2: Render safe tool results**

Listen for `ui/notifications/tool-result`, validate the recovery shape in browser code, use `<video controls playsinline preload="metadata">` for video, an `<img>` for image, and a neutral status state when no completed media exists.

- [ ] **Step 3: Add portable first-party navigation**

Send `ui/open-link` over the MCP Apps bridge; feature-detect `window.openai.openExternal` and fall back to the first-party anchor URL.

- [ ] **Step 4: Register the read-only render tool**

Use the same strict `{ jobId }` schema as `get_generation_status`, attach `_meta.ui.resourceUri`, return the existing recovery DTO, and preserve the current resource links.

- [ ] **Step 5: Run the focused tests to verify GREEN**

Run: `node --import tsx --test tests/mcp-inline-media-app.test.ts tests/mcp-tools-contract.test.ts`

Expected: PASS.

### Task 3: Teach hosts when to render and update contracts

**Files:**
- Modify: `frontend/src/server/mcp/instructions.ts`
- Modify: `plugins/maxvideoai/skills/maxvideoai/SKILL.md`
- Modify: `tests/mcp-instructions.test.ts`
- Modify: `tests/mcp-plugin-contract.test.ts`
- Modify: `docs/engineering/mcp-architecture.md`
- Modify: `docs/operations/mcp-host-compatibility-matrix.md`

**Interfaces:**
- Consumes: completed generation recovery returned by existing tools.
- Produces: assistant guidance to call `present_generation` once after completion or when the user asks to view the result.

- [ ] **Step 1: Write failing instruction assertions**

Assert that hosts are told to use `present_generation` only after completion and that unsupported UI hosts retain the library/resource-link fallback.

- [ ] **Step 2: Run the instruction tests to verify RED**

Run: `node --import tsx --test tests/mcp-instructions.test.ts tests/mcp-plugin-contract.test.ts`

Expected: FAIL because the new tool is not documented.

- [ ] **Step 3: Add concise host guidance and architecture notes**

Update the server instructions, shared skill, tool allowlist, architecture boundary, and compatibility matrix without claiming a host pass.

- [ ] **Step 4: Run the instruction tests to verify GREEN**

Run: `node --import tsx --test tests/mcp-instructions.test.ts tests/mcp-plugin-contract.test.ts`

Expected: PASS.

### Task 4: Verify the implementation and capture real evidence

**Files:**
- Create: `design-qa.md`
- Modify after evidence: `docs/marketing/mcp-demo-evidence.md`
- Modify after evidence: `docs/operations/mcp-host-compatibility-matrix.md`

**Interfaces:**
- Consumes: hosted staging MCP revision with the new resource and tool.
- Produces: a verified host screenshot containing the real conversation and playable media card.

- [ ] **Step 1: Run static and MCP contract verification**

Run: `frontend/node_modules/.bin/tsc -p frontend/tsconfig.json --noEmit`

Run: `node --import tsx --test tests/mcp-*.test.ts`

Run: `npm run lint:exposure`

Run: `git diff --check`

- [ ] **Step 2: Inspect the rendered card against the selected reference**

Capture the same inline-card state, compare it to the selected design image, record issues in `design-qa.md`, fix P0-P2 issues, and repeat until `final result: passed`.

- [ ] **Step 3: Deploy only to the isolated staging host**

Use the existing staging deployment script and keep all public-production flags false.

- [ ] **Step 4: Exercise Claude and ChatGPT separately**

Recover one existing completed generation, invoke `present_generation`, confirm native playback, first-party navigation, dark/light rendering, and non-UI fallback behavior on each exact host version.

- [ ] **Step 5: Record only proven compatibility**

Add the exact deployment, host version, test result, provenance, and screenshot path to the evidence documents. Do not broaden claims from one host to another.

