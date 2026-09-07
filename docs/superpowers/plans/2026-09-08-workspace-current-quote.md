# Workspace Current Quote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A generation price belongs only to the current draft and account; stale, failed or pending quotes cannot remain actionable.

**Architecture:** Keep canonical billing on the server and workspace submission in its existing owners. Extract only the browser-safe preflight payload builder, then bind observed quote state to its exact current request and auth identity. This also provides one payload owner for the subsequent model-change preview.

**Tech Stack:** Next.js, React, TypeScript, node:test, JSDOM.

**Spec:** docs/design/global-app-concept/integration-contract.md, paragraphs on price before generation and comparing the current draft. This is the first bounded prerequisite of the parallel roadmap, not completion of all creator continuity work.

## Global Constraints

- Preserve current prices, canonical server authority, exact original asset IDs/URLs, and existing auth/wallet behavior.
- No production writes, paid requests, push, main merge, deployment or inherited remote environment.
- AppClient remains an orchestrator. No new state library. Preserve backwards-compatible public hook return names.
- User requires Astra for delegated work. Use the existing isolated codex/app-catalogue-validation branch.
- Existing supported controls and locales remain available; pending/error states do not display an old price as current.

### Task 1: Bind workspace quotes to the current request

**Files:**
- Create: frontend/app/(core)/(workspace)/app/_lib/workspace-preflight-request.ts
- Modify: frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate.ts
- Test/update: tests/workspace-pricing-gate-hook-contract.test.ts
- Create: tests/workspace-preflight-request.test.ts, tests/workspace-pricing-lifecycle-dom.test.ts
- If submission currently allows a missing quote, make the smallest guard in the existing generation/preflight owner and update its covering behavior test. Do not move wallet responsibilities.

**Interfaces:**
- Consumes the existing EngineCaps, FormState, Mode, ReferenceAsset, PreflightRequest/Response, buildWorkspacePreflightInputs, workspaceModeSupportsRequestField and runPreflight(payload, {accessToken}).
- Produces this browser-safe builder, preserving the existing request semantics exactly:

```ts
export type WorkspacePreflightRequestOptions = {
  form: FormState;
  selectedEngine: EngineCaps;
  submissionMode: Mode;
  effectiveDurationSec: number;
  supportsAudioToggle: boolean;
  voiceControlEnabled: boolean;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  memberTier: 'Member' | 'Plus' | 'Pro';
};
export function buildWorkspacePreflightRequest(options: WorkspacePreflightRequestOptions): PreflightRequest;
```

The builder moves the current payload construction literally: mode field support governs resolution/aspect ratio; audio/voice fields use the existing booleans; inputs preserve originals and unresolved IDs so the server can reject them; extra inputs and memberTier keep their contract. Do not put iterations into this one-output server request; current total multiplies the matching unit price by the live iterations.

- [ ] Add meaningful request tests: unsupported fields absent, audio/voice optional fields, input original identity and unresolved asset behavior. Use actual engine/schema fixtures from existing tests where possible.
- [ ] Add a JSDOM hook lifecycle test using deferred responses. Record hook outputs during render, not only after effects. Test exact outcomes:

```ts
// A resolved request may expose its quote.
assert.equal(current.price, 1.25);
// Every render after changing engine/duration/inputs/auth is masked until B resolves.
assert.ok(observedAfterChange.every(value => value.preflight === null && value.price === null));
// A late A response never installs into B; a failure in B never reveals A again.
assert.equal(current.preflight, null);
assert.equal(current.price, null);
// Iteration count updates a matching unit quote; it cannot reuse a mismatched quote.
assert.equal(current.price, 3.75);
```

Cover rapid A→B→A, logout/auth-not-ready, errors/retry, and empty form. Do not rely only on callback mocks or source-text assertions. If a focused request hook is necessary for testing and responsibility, extract it into _hooks/useWorkspacePreflightQuote.ts with explicit inputs and preserve useWorkspacePricingGate as the top-up/auth orchestrator. Keep request dependencies bounded and avoid loops on semantically equal payloads.

- [ ] Run focused tests and capture the expected failing behavior before the fix. Use the sanitized local validation launcher; never call live generation.
- [ ] Extract the payload builder and implement scoped quote observations. Derive current exposure synchronously from matching request identity plus access token/auth readiness; do not rely only on a cleanup effect to hide an old-account quote. Keep auth tokens only in transient equality checks, never persistent keys/logs. Ignore superseded completions. Pending must start on request mismatch before a debounce elapses. For invalid/failed quote, expose no actionable preflight or total. Preserve caller-set form/preflight errors and quote-derived errors correctly.
- [ ] Read the existing submission guard and ensure no failed/stale/null quote can slip through the normal submit path during the recalculation window. Reuse the existing guard rather than creating parallel billing logic.
- [ ] Update the architecture contract so it asserts the new builder ownership and unchanged wallet/auth responsibilities. Run focused request/lifecycle/contracts, frontend typecheck and lint; report exact commands and counts. The controller runs the full regression suite once for the combined creator increment.
- [ ] Review the complete scoped diff, commit only Task 1 files and write the implementer report. Include actual red/green evidence, architecture changes and any residual limitations.

## Validation and next increment

The controller checks browser-visible recalculation after this task and performs the independent review. The next model-change work consumes buildWorkspacePreflightRequest instead of reproducing commercial requests. Image/audio pricing and a global billing migration are not folded into this bounded fix; their existing contracts are retained and will be checked in creator continuity qualification.
