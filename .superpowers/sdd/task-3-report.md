# Trial Task 3 report: verified-email and account eligibility

## Status

DONE

Implemented on `codex/mcp-foundation-clean` from `bad8ed20be124ac07b6e901616c64551a2875b9a`.

## TDD evidence

The complete Task 3 behavior contract was added to
`tests/mcp-trial-eligibility.test.ts` before production changes.

Initial RED command:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-trial-eligibility.test.ts
```

Result: exit 1. The runner failed on the intentionally absent
`frontend/src/server/agent-api/trial-eligibility.ts` module with
`MODULE_NOT_FOUND`; no production Task 3 file existed yet.

After the minimal implementation, the same focused command exited 0 with
11 passed and 0 failed. The tests cover:

- the exact two-part static/server gate and disabled-path dependency short circuit;
- unverified email and the trusted account-connections verification action;
- verified password and confirmed Google product cases represented only by
  `principal.emailVerified === true`;
- missing, available, released, reserved, and consumed entitlement states;
- immutable public Seedance Mini preset output;
- active restriction redaction and downstream short circuit;
- unsupported live presets and the closed public reason allowlist;
- restriction, entitlement, catalog, and assertion failures without raw-error leakage;
- enabled account-status integration and wallet preservation when trial lookup fails.

## Implementation and decisions

- Added `getTrialEligibility()` with injected dependencies for isolated tests and
  production defaults for `FEATURES.mcp.trial`, `ENV.MCP_TRIAL_ENABLED`, active
  restriction lookup, entitlement lookup, public catalog lookup, and preset
  validation.
- The gate requires `featureEnabled === true` and
  `environmentEnabled === 'true'`. Disabled and unverified paths do not call
  restriction, entitlement, or catalog dependencies.
- Unverified users receive only
  `{ type: 'verify_email', url: accountUrl }`; account status overwrites any
  eligibility override with its server-resolved account URL.
- Restriction lookup runs before entitlement/catalog access for verified users.
  A row maps only to `account_restricted`; dependency errors map only to
  `service_unavailable`.
- Missing, `available`, and `released` entitlement states require the current
  public Seedance Mini candidate and `assertTrialPresetSupported()`. `reserved`
  and `consumed` expose only their nullable `jobId`.
- `TrialPresetUnsupportedError` from live preset validation maps only to
  `preset_unavailable`. Its private reason is never returned.
- The available preset summary is frozen, uses values from `MCP_TRIAL_PRESET`,
  freezes its copied aspect-ratio list, and derives `audioOptional` from the
  validated live T2V mode capability.
- `AgentAccountStatus.trial` now uses the safe `TrialStatus` union. Existing
  account-status calls remain source-compatible, checked-in defaults still
  report `disabled`, and an unexpected trial resolver failure is contained so
  the already-read wallet projection remains intact.
- Added the server-only `MCP_TRIAL_ENABLED` environment key without changing any
  public publication value.
- Confirmation was deliberately not edited; Task 6 owns its required
  confirmation-time restriction re-check.

## Final verification evidence

1. Task 3, foundation account/tool contracts, and complete Task 1/2 trial suites:

   ```bash
   ./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
     tests/mcp-trial-eligibility.test.ts \
     tests/mcp-account-status.test.ts \
     tests/mcp-tools-contract.test.ts \
     tests/mcp-trial-preset.test.ts \
     tests/mcp-trial-migration.test.ts \
     tests/mcp-trial-entitlement-repository.test.ts \
     tests/mcp-trial-risk-repository.test.ts
   ```

   Result: exit 0; 51 passed, 0 failed. The disposable PostgreSQL migration and
   concurrency test passed. The tool safety test emitted its expected sanitized
   unexpected-failure log while passing.

2. Additional agent facade, default-service, transport, and docs regressions:

   ```bash
   ./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
     tests/mcp-agent-contract.test.ts \
     tests/mcp-default-services-config.test.ts \
     tests/mcp-transport-contract.test.ts \
     tests/mcp-docs-content.test.ts
   ```

   Result: exit 0; 30 passed, 0 failed.

3. TypeScript:

   ```bash
   ./frontend/node_modules/.bin/tsc --project frontend/tsconfig.json --noEmit --pretty false
   ```

   Result: exit 0 with no diagnostics.

4. Lint and public exposure:

   ```bash
   npm --prefix frontend run lint
   npm run lint:exposure
   ```

   Result: both exit 0; public exposure passed.

5. Architecture audit:

   ```bash
   npm run architecture:audit -- --min-lines 500
   ```

   Result: exit 0. No Task 3 owner appears in the 500-line report.

6. Publication flag contract:

   ```bash
   ./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
     tests/mcp-config.test.ts
   ```

   Result: exit 0; 8 passed, 0 failed. All eight publication flags remain
   exactly `false`.

7. Diff hygiene:

   ```bash
   git diff --check
   ```

   Result: exit 0.

## Changed files

- `.superpowers/sdd/task-3-report.md`
- `frontend/src/lib/env.ts`
- `frontend/src/server/agent-api/account-status.ts`
- `frontend/src/server/agent-api/index.ts`
- `frontend/src/server/agent-api/trial-eligibility.ts`
- `frontend/src/server/agent-api/types.ts`
- `tests/mcp-trial-eligibility.test.ts`

## Self-review and remaining concerns

- Reviewed the finished diff for identity-claim leakage, restriction-detail
  leakage, raw errors, gate bypasses, mutable preset data, wallet corruption,
  provider imports, confirmation edits, registry/tool edits, and flag changes.
- No Task 3 implementation concerns remain.
- All eight publication flags remain false. No network call, deployment, push,
  merge, external message, MCP registry/tool change, provider submission change,
  or persistent database mutation was performed. The only database test used the
  repository's disposable local PostgreSQL harness.
