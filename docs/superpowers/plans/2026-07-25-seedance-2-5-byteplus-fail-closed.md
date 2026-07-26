# Seedance 2.5 BytePlus Fail-Closed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace implicit Seedance Fast fallbacks with explicit BytePlus profiles while preserving every current Seedance 2.0 runtime and billing value.

**Architecture:** A provider-local profile registry becomes the single source for engine-to-model selection, runtime capabilities, routing policy, request validation, payload limits, generated-audio support, and pricing profile selection. A separate profile-policy module owns environment dispatch and runtime transformation so the provider facade stays below its architecture limit. Read-only routing checks return `false` for unknown engines; an engine explicitly declaring BytePlus without a profile fails during route preflight, before billing, and request/accounting operations require a recognized profile.

**Tech Stack:** TypeScript, Next.js App Router, Node test runner through `tsx`, BytePlus ModelArk adapter, PostgreSQL billing orchestration.

## Global Constraints

- Do not add `seedance-2-5` to runtime code, `frontend/config/model-registry.json`, or any generated catalog.
- Do not add or guess a BytePlus Seedance 2.5 model ID, price, dimensions, FPS, limits, or API behavior.
- Preserve the current model IDs, modes, durations, resolutions, aspect ratios, 24 FPS behavior, generated-audio behavior, provider routing, and unit prices of Seedance 2.0 Standard, Fast, Mini, and hidden direct Fast.
- Preserve existing public helper exports as compatibility wrappers where they have callers.
- Unknown engine selection, model resolution, and accounting must fail before a provider request or charge; never recover with the Fast model or Fast price.
- Reject a raw engine whose `providerMeta.provider` declares `byteplus_modelark` when no profile exists; never let it fall through to Fal.
- Make provider/admin/mode/pricing-key dispatch exhaustive; a future key must not inherit Mini or Fast behavior through a terminal fallback.
- Pass profile modes, durations, resolutions, aspect ratios, and generated-audio support through request normalization and payload construction.
- Keep canonical model identity in `frontend/config/model-registry.json`; provider IDs remain in the BytePlus provider/config layer.
- Follow red-green-refactor, make one focused commit per task, and keep unrelated worktree changes intact.

---

## File Map

- Create `frontend/src/server/video-providers/byteplus-modelark-profiles.ts`: immutable current-engine profiles and strict lookup.
- Create `frontend/src/server/video-providers/byteplus-modelark-profile-policy.ts`: exhaustive environment policy, pre-billing route preflight, and runtime transformation.
- Create `tests/byteplus-seedance-profiles.test.ts`: profile parity and unknown-engine contracts.
- Modify `frontend/src/server/video-providers/byteplus-modelark.ts`: thin facade/config/client after moving runtime and routing policy.
- Modify `frontend/app/api/generate/_lib/request-options-byteplus.ts`: profile-backed aspect ratio, duration, resolution, and audio normalization.
- Modify `frontend/app/api/generate/_lib/request-options.ts`: honor profile generated-audio support.
- Modify `frontend/src/server/video-providers/byteplus-modelark-payload.ts`: accept profile-backed modes and aspect ratios.
- Modify `frontend/app/api/generate/_lib/route-context.ts`: generic profile-backed BytePlus route and admin checks.
- Modify `frontend/server/byteplus-accounting.ts`: explicit pricing-profile dispatch.
- Modify `frontend/app/api/generate/_lib/byteplus-submission.ts`: retain a defense-in-depth profile assertion and pass profile capabilities.
- Modify `tests/byteplus-provider-architecture.test.ts`: module ownership and strict-lookup contracts.
- Modify `tests/generate-route-context.test.ts`: routing parity.
- Modify `tests/generate-request-options.test.ts`: profile capability propagation.
- Modify `tests/generate-byteplus-submission.test.ts`: direct-call no-request and rollback defense.
- Modify `tests/seedance-2-pricing.test.ts`: current-price parity and unknown-price rejection.

### Task 1: Add the explicit BytePlus Seedance profile registry

**Files:**
- Create: `frontend/src/server/video-providers/byteplus-modelark-profiles.ts`
- Create: `tests/byteplus-seedance-profiles.test.ts`
- Modify: `frontend/src/server/video-providers/byteplus-modelark.ts`

**Interfaces:**
- Consumes: `Mode`, `Resolution`, and `AspectRatio` from `@/types/engines`; current constants from `byteplus-modelark-constants.ts`; `BytePlusModelArkError`.
- Produces:
  - `BytePlusSeedanceModelConfigKey`
  - `BytePlusSeedancePricingProfileKey`
  - `BytePlusSeedanceProfile`
  - `getBytePlusSeedanceProfile(engineId): BytePlusSeedanceProfile | null`
  - `requireBytePlusSeedanceProfile(engineId): BytePlusSeedanceProfile`

- [ ] **Step 1: Write the failing profile test**

Create `tests/byteplus-seedance-profiles.test.ts` with table-driven parity and strict lookup:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getBytePlusSeedanceProfile,
  requireBytePlusSeedanceProfile,
} from '../frontend/src/server/video-providers/byteplus-modelark-profiles';

const expected = [
  {
    engineId: 'seedance-2-0',
    modelConfigKey: 'seedanceModelId',
    pricingProfileKey: 'standard',
    resolutions: ['480p', '720p', '1080p', '4k'],
    durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    alwaysDirect: false,
    providerOverrideKey: 'SEEDANCE_2_PROVIDER',
    adminOnlyKey: 'SEEDANCE_2_BYTEPLUS_ADMIN_ONLY',
    allowedModesKey: 'SEEDANCE_2_BYTEPLUS_MODES',
  },
  {
    engineId: 'seedance-2-0-fast',
    modelConfigKey: 'seedanceFastModelId',
    pricingProfileKey: 'fast',
    resolutions: ['480p', '720p'],
    durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    alwaysDirect: false,
    providerOverrideKey: 'SEEDANCE_FAST_PROVIDER',
    adminOnlyKey: 'SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY',
    allowedModesKey: 'SEEDANCE_FAST_BYTEPLUS_MODES',
  },
  {
    engineId: 'seedance-2-0-mini',
    modelConfigKey: 'seedanceMiniModelId',
    pricingProfileKey: 'mini',
    resolutions: ['480p', '720p'],
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    alwaysDirect: true,
    providerOverrideKey: null,
    adminOnlyKey: 'SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY',
    allowedModesKey: 'SEEDANCE_MINI_BYTEPLUS_MODES',
  },
  {
    engineId: 'seedance-2-0-fast-byteplus',
    modelConfigKey: 'seedanceFastModelId',
    pricingProfileKey: 'fast',
    resolutions: ['480p', '720p'],
    durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    alwaysDirect: true,
    providerOverrideKey: 'SEEDANCE_FAST_PROVIDER',
    adminOnlyKey: 'SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY',
    allowedModesKey: 'SEEDANCE_FAST_BYTEPLUS_MODES',
  },
] as const;

test('every current BytePlus Seedance engine has an explicit parity profile', () => {
  for (const entry of expected) {
    const profile = requireBytePlusSeedanceProfile(entry.engineId);
    assert.equal(profile.modelConfigKey, entry.modelConfigKey);
    assert.equal(profile.pricingProfileKey, entry.pricingProfileKey);
    assert.deepEqual(profile.resolutions, entry.resolutions);
    assert.deepEqual(profile.durationOptions, entry.durations);
    assert.equal(profile.routing.alwaysDirect, entry.alwaysDirect);
    assert.equal(profile.routing.providerOverrideKey, entry.providerOverrideKey);
    assert.equal(profile.routing.adminOnlyKey, entry.adminOnlyKey);
    assert.equal(profile.routing.allowedModesKey, entry.allowedModesKey);
    assert.deepEqual(profile.supportedModes, ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
    assert.deepEqual(profile.aspectRatios, ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
    assert.equal(profile.framesPerSecond, 24);
    assert.equal(profile.generatedAudio, true);
  }
});

test('Seedance 2.5 has no pre-release provider profile', () => {
  assert.equal(getBytePlusSeedanceProfile('seedance-2-5'), null);
  assert.throws(
    () => requireBytePlusSeedanceProfile('seedance-2-5'),
    (error: unknown) =>
      error instanceof Error &&
      error.name === 'BytePlusModelArkError' &&
      (error as Error & { code?: string }).code === 'BYTEPLUS_ENGINE_PROFILE_MISSING'
  );
});
```

- [ ] **Step 2: Run the test and verify the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/byteplus-seedance-profiles.test.ts
```

Expected: FAIL with `Cannot find module ...byteplus-modelark-profiles`.

- [ ] **Step 3: Implement the immutable profiles and strict lookup**

Create `frontend/src/server/video-providers/byteplus-modelark-profiles.ts` with these exact public types and records:

```ts
import type { AspectRatio, Mode, Resolution } from '@/types/engines';
import {
  BYTEPLUS_SEEDANCE_ASPECT_RATIOS,
  BYTEPLUS_SEEDANCE_DURATION_OPTIONS,
  BYTEPLUS_SEEDANCE_FAST_ENGINE_ID,
  BYTEPLUS_SEEDANCE_FAST_RESOLUTIONS,
  BYTEPLUS_SEEDANCE_MINI_DURATION_OPTIONS,
  BYTEPLUS_SEEDANCE_MINI_RESOLUTIONS,
  BYTEPLUS_SEEDANCE_MODES,
  BYTEPLUS_SEEDANCE_RESOLUTIONS,
  PUBLIC_SEEDANCE_ENGINE_ID,
  PUBLIC_SEEDANCE_FAST_ENGINE_ID,
  PUBLIC_SEEDANCE_MINI_ENGINE_ID,
} from './byteplus-modelark-constants';
import { BytePlusModelArkError } from './byteplus-modelark-error';

export type BytePlusSeedanceModelConfigKey =
  | 'seedanceModelId'
  | 'seedanceFastModelId'
  | 'seedanceMiniModelId';

export type BytePlusSeedancePricingProfileKey = 'standard' | 'fast' | 'mini';

export type BytePlusSeedanceProviderOverrideKey =
  | 'SEEDANCE_2_PROVIDER'
  | 'SEEDANCE_FAST_PROVIDER'
  | null;

export type BytePlusSeedanceAdminOnlyKey =
  | 'SEEDANCE_2_BYTEPLUS_ADMIN_ONLY'
  | 'SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY'
  | 'SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY';

export type BytePlusSeedanceAllowedModesKey =
  | 'SEEDANCE_2_BYTEPLUS_MODES'
  | 'SEEDANCE_FAST_BYTEPLUS_MODES'
  | 'SEEDANCE_MINI_BYTEPLUS_MODES';

export type BytePlusSeedanceProfile = Readonly<{
  engineId: string;
  modelConfigKey: BytePlusSeedanceModelConfigKey;
  supportedModes: readonly Mode[];
  durationOptions: readonly number[];
  resolutions: readonly Resolution[];
  aspectRatios: readonly AspectRatio[];
  framesPerSecond: number;
  generatedAudio: boolean;
  pricingProfileKey: BytePlusSeedancePricingProfileKey;
  routing: Readonly<{
    providerOverrideKey: BytePlusSeedanceProviderOverrideKey;
    adminOnlyKey: BytePlusSeedanceAdminOnlyKey;
    allowedModesKey: BytePlusSeedanceAllowedModesKey;
    alwaysDirect: boolean;
  }>;
}>;

const shared = {
  supportedModes: BYTEPLUS_SEEDANCE_MODES,
  aspectRatios: BYTEPLUS_SEEDANCE_ASPECT_RATIOS,
  framesPerSecond: 24,
  generatedAudio: true,
} as const;

const BYTEPLUS_SEEDANCE_PROFILES: Readonly<Record<string, BytePlusSeedanceProfile>> = {
  [PUBLIC_SEEDANCE_ENGINE_ID]: {
    ...shared,
    engineId: PUBLIC_SEEDANCE_ENGINE_ID,
    modelConfigKey: 'seedanceModelId',
    durationOptions: BYTEPLUS_SEEDANCE_DURATION_OPTIONS,
    resolutions: BYTEPLUS_SEEDANCE_RESOLUTIONS,
    pricingProfileKey: 'standard',
    routing: {
      providerOverrideKey: 'SEEDANCE_2_PROVIDER',
      adminOnlyKey: 'SEEDANCE_2_BYTEPLUS_ADMIN_ONLY',
      allowedModesKey: 'SEEDANCE_2_BYTEPLUS_MODES',
      alwaysDirect: false,
    },
  },
  [PUBLIC_SEEDANCE_FAST_ENGINE_ID]: {
    ...shared,
    engineId: PUBLIC_SEEDANCE_FAST_ENGINE_ID,
    modelConfigKey: 'seedanceFastModelId',
    durationOptions: BYTEPLUS_SEEDANCE_DURATION_OPTIONS,
    resolutions: BYTEPLUS_SEEDANCE_FAST_RESOLUTIONS,
    pricingProfileKey: 'fast',
    routing: {
      providerOverrideKey: 'SEEDANCE_FAST_PROVIDER',
      adminOnlyKey: 'SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY',
      allowedModesKey: 'SEEDANCE_FAST_BYTEPLUS_MODES',
      alwaysDirect: false,
    },
  },
  [PUBLIC_SEEDANCE_MINI_ENGINE_ID]: {
    ...shared,
    engineId: PUBLIC_SEEDANCE_MINI_ENGINE_ID,
    modelConfigKey: 'seedanceMiniModelId',
    durationOptions: BYTEPLUS_SEEDANCE_MINI_DURATION_OPTIONS,
    resolutions: BYTEPLUS_SEEDANCE_MINI_RESOLUTIONS,
    pricingProfileKey: 'mini',
    routing: {
      providerOverrideKey: null,
      adminOnlyKey: 'SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY',
      allowedModesKey: 'SEEDANCE_MINI_BYTEPLUS_MODES',
      alwaysDirect: true,
    },
  },
  [BYTEPLUS_SEEDANCE_FAST_ENGINE_ID]: {
    ...shared,
    engineId: BYTEPLUS_SEEDANCE_FAST_ENGINE_ID,
    modelConfigKey: 'seedanceFastModelId',
    durationOptions: BYTEPLUS_SEEDANCE_DURATION_OPTIONS,
    resolutions: BYTEPLUS_SEEDANCE_FAST_RESOLUTIONS,
    pricingProfileKey: 'fast',
    routing: {
      providerOverrideKey: 'SEEDANCE_FAST_PROVIDER',
      adminOnlyKey: 'SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY',
      allowedModesKey: 'SEEDANCE_FAST_BYTEPLUS_MODES',
      alwaysDirect: true,
    },
  },
};

export function getBytePlusSeedanceProfile(
  engineId: string | null | undefined
): BytePlusSeedanceProfile | null {
  const normalizedEngineId = engineId?.trim();
  return normalizedEngineId ? BYTEPLUS_SEEDANCE_PROFILES[normalizedEngineId] ?? null : null;
}

export function requireBytePlusSeedanceProfile(
  engineId: string | null | undefined
): BytePlusSeedanceProfile {
  const profile = getBytePlusSeedanceProfile(engineId);
  if (profile) return profile;
  throw new BytePlusModelArkError('Unsupported BytePlus Seedance engine profile.', {
    status: 400,
    code: 'BYTEPLUS_ENGINE_PROFILE_MISSING',
  });
}
```

Re-export the five profile symbols from `byteplus-modelark.ts` in exactly two source lines so the existing `< 430` line architecture contract remains green:

```ts
export { getBytePlusSeedanceProfile, requireBytePlusSeedanceProfile } from './byteplus-modelark-profiles';
export type { BytePlusSeedanceModelConfigKey, BytePlusSeedancePricingProfileKey, BytePlusSeedanceProfile } from './byteplus-modelark-profiles';
```

Do not re-export the internal record.

- [ ] **Step 4: Run the profile test and provider architecture test**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/byteplus-seedance-profiles.test.ts \
  tests/byteplus-provider-architecture.test.ts
```

Expected: PASS with no existing adapter-boundary regression.

- [ ] **Step 5: Commit the profile registry**

```bash
git add \
  frontend/src/server/video-providers/byteplus-modelark-profiles.ts \
  frontend/src/server/video-providers/byteplus-modelark.ts \
  tests/byteplus-seedance-profiles.test.ts
git commit -m "refactor: add explicit BytePlus Seedance profiles"
```

### Task 2: Move routing and runtime capability selection onto profiles

**Files:**
- Create: `frontend/src/server/video-providers/byteplus-modelark-profile-policy.ts`
- Modify: `frontend/src/server/video-providers/byteplus-modelark.ts`
- Modify: `frontend/app/api/generate/_lib/request-options-byteplus.ts`
- Modify: `frontend/src/server/video-providers/byteplus-modelark-payload.ts`
- Modify: `frontend/app/api/generate/_lib/byteplus-submission.ts`
- Modify: `frontend/app/api/generate/_lib/route-context.ts`
- Modify: `tests/byteplus-provider-architecture.test.ts`
- Modify: `tests/generate-route-context.test.ts`
- Modify: `tests/generate-request-options.test.ts`
- Modify: `tests/generate-byteplus-submission.test.ts`
- Test: `tests/byteplus-seedance-profiles.test.ts`

**Interfaces:**
- Consumes: `getBytePlusSeedanceProfile` and `requireBytePlusSeedanceProfile` from Task 1.
- Produces:
  - `shouldRouteSeedanceEngineToBytePlus(engineId): boolean`
  - `isBytePlusSeedanceAdminOnly(engineId): boolean`
  - `resolveBytePlusSeedanceRouteProfile(engineId, declaredProvider)`
  - strict existing capability/model helpers backed by `requireBytePlusSeedanceProfile`
  - profile-backed request and payload validation
  - current named route/admin helpers retained as wrappers

- [ ] **Step 1: Add failing routing and strict-capability assertions**

Append these assertions to `tests/byteplus-seedance-profiles.test.ts` and source-boundary assertions to `tests/byteplus-provider-architecture.test.ts`:

```ts
import {
  getBytePlusSeedanceAllowedAspectRatios,
  getBytePlusSeedanceAllowedResolutions,
  getBytePlusSeedanceDurationOptions,
  isBytePlusSeedanceAdminOnly,
  resolveBytePlusSeedanceRouteProfile,
  resolveBytePlusSeedanceModelId,
} from '../frontend/src/server/video-providers/byteplus-modelark';

test('strict capability and model helpers reject an unknown engine', () => {
  const config = {
    seedanceModelId: 'standard-id',
    seedanceFastModelId: 'fast-id',
    seedanceMiniModelId: 'mini-id',
  } as never;
  assert.throws(() => getBytePlusSeedanceAllowedResolutions('seedance-2-5'));
  assert.throws(() => getBytePlusSeedanceDurationOptions('seedance-2-5'));
  assert.throws(() => resolveBytePlusSeedanceModelId('seedance-2-5', config));
  assert.equal(isBytePlusSeedanceAdminOnly('seedance-2-5'), false);
  assert.equal(
    resolveBytePlusSeedanceRouteProfile('luma-ray-2', 'fal'),
    null
  );
  assert.throws(
    () =>
      resolveBytePlusSeedanceRouteProfile(
        'seedance-2-5',
        'byteplus_modelark'
      ),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code ===
        'BYTEPLUS_ENGINE_PROFILE_MISSING'
  );
});

test('recognized model selection preserves all current config keys', () => {
  const config = {
    seedanceModelId: 'standard-id',
    seedanceFastModelId: 'fast-id',
    seedanceMiniModelId: 'mini-id',
  } as never;
  assert.equal(resolveBytePlusSeedanceModelId('seedance-2-0', config), 'standard-id');
  assert.equal(resolveBytePlusSeedanceModelId('seedance-2-0-fast', config), 'fast-id');
  assert.equal(resolveBytePlusSeedanceModelId('seedance-2-0-mini', config), 'mini-id');
  assert.equal(resolveBytePlusSeedanceModelId('seedance-2-0-fast-byteplus', config), 'fast-id');
  assert.deepEqual(
    getBytePlusSeedanceAllowedAspectRatios('seedance-2-0'),
    ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16']
  );
});

test('recognized engine with an empty configured model id fails before submission', () => {
  const config = {
    seedanceModelId: '',
    seedanceFastModelId: 'fast-id',
    seedanceMiniModelId: 'mini-id',
  } as never;
  assert.throws(
    () => resolveBytePlusSeedanceModelId('seedance-2-0', config),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code === 'BYTEPLUS_MODEL_ID_MISSING'
  );
});
```

In the existing `route context helper exposes the expected guard contract` test in `tests/generate-route-context.test.ts`, assert against its existing `helperSource` constant:

```ts
assert.match(helperSource, /isBytePlusSeedanceAdminOnly/);
assert.match(helperSource, /resolveBytePlusSeedanceRouteProfile/);
assert.match(
  helperSource,
  /isBytePlusV1a\s*&&\s*!getBytePlusSeedanceAllowedModes\(engine\.id\)\.includes\(mode\)/
);
assert.doesNotMatch(
  helperSource,
  /const bytePlusModeAllowed\s*=\s*getBytePlusSeedanceAllowedModes/
);
assert.doesNotMatch(helperSource, /isPublicSeedanceStandardBytePlus/);
assert.doesNotMatch(helperSource, /isPublicSeedanceFastBytePlus/);
assert.doesNotMatch(helperSource, /isPublicSeedanceMiniBytePlus/);
```

In `tests/byteplus-provider-architecture.test.ts`, add a runtime-parity test for the hidden direct engine:

```ts
test('hidden direct Fast keeps its narrow raw runtime caps by default', () => {
  const hiddenEntry = listFalEngines().find(
    (entry) => entry.id === 'seedance-2-0-fast-byteplus'
  );
  assert.ok(hiddenEntry);
  const runtimeEngine = applyBytePlusSeedanceRuntimeOptions(hiddenEntry.engine);
  assert.deepEqual(runtimeEngine.modes, ['t2v']);
  assert.deepEqual(runtimeEngine.resolutions, ['720p']);
  assert.deepEqual(runtimeEngine.aspectRatios, ['16:9']);
  assert.deepEqual(hiddenEntry.modes[0]?.ui.resolution, ['720p']);
assert.equal(hiddenEntry.modes[0]?.ui.audioToggle, false);
});

test('profile policy is separated from the thin provider facade', () => {
  const facade = readFileSync(
    'frontend/src/server/video-providers/byteplus-modelark.ts',
    'utf8'
  );
  const policy = readFileSync(
    'frontend/src/server/video-providers/byteplus-modelark-profile-policy.ts',
    'utf8'
  );
  assert.ok(facade.split('\n').length < 430);
  assert.match(facade, /from '\.\/byteplus-modelark-profile-policy'/);
  assert.match(policy, /export function applyBytePlusSeedanceRuntimeOptions/);
  assert.match(policy, /export function resolveBytePlusSeedanceRouteProfile/);
  assert.doesNotMatch(facade, /function filterInputFieldsForModes/);
});
```

- [ ] **Step 2: Run the tests and verify the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/byteplus-seedance-profiles.test.ts \
  tests/byteplus-provider-architecture.test.ts \
  tests/generate-route-context.test.ts
```

Expected: FAIL because unknown IDs still inherit Fast caps/model selection and the generic routing helpers do not exist.

- [ ] **Step 3: Extract exhaustive profile policy and runtime transformation**

Create `byteplus-modelark-profile-policy.ts`. Import `ENV`; `AspectRatio`,
`EngineCaps`, `EngineInputField`, `Mode`, and `Resolution`; all current
Seedance constants/predicates; `getBytePlusSeedanceProfile`,
`requireBytePlusSeedanceProfile`, and `BytePlusSeedanceProfile`; and
`BytePlusModelArkError`. These must be real imports in this module—facade
re-exports do not create local bindings.

Define a private `envFlagEnabled` in the policy module. Keep the facade's
existing private copy for the global `BYTEPLUS_ARK_ENABLED` switch so neither
module imports private implementation details from the other.

Move `splitCsvEnv`, `expandBytePlusFieldModes`,
`filterInputFieldsForModes`, every provider/admin/mode routing helper,
`getBytePlusSeedanceAllowed*`, `resolveBytePlusSeedanceModelId`, and
`applyBytePlusSeedanceRuntimeOptions` out of `byteplus-modelark.ts` into the
new policy module.

Replace the old global-constant mode parser with a profile-scoped parser:

```ts
function allowedBytePlusModes(
  value: string | undefined,
  supportedModes: readonly Mode[]
): Mode[] {
  const configured = splitCsvEnv(value);
  const modes = configured.filter((mode): mode is Mode =>
    supportedModes.includes(mode as Mode)
  );
  if (modes.length) return modes;
  return supportedModes.includes('t2v')
    ? ['t2v']
    : supportedModes.slice(0, 1);
}
```

Use exhaustive key readers:

```ts
function assertNever(value: never): never {
  throw new BytePlusModelArkError(
    `Unsupported BytePlus Seedance policy key: ${String(value)}`,
    { status: 500, code: 'BYTEPLUS_PROFILE_POLICY_INVALID' }
  );
}

function readProviderOverride(
  key: BytePlusSeedanceProfile['routing']['providerOverrideKey']
): 'fal' | 'byteplus_modelark' {
  let raw: string | undefined;
  switch (key) {
    case 'SEEDANCE_2_PROVIDER':
      raw = ENV.SEEDANCE_2_PROVIDER;
      break;
    case 'SEEDANCE_FAST_PROVIDER':
      raw = ENV.SEEDANCE_FAST_PROVIDER;
      break;
    case null:
      raw = undefined;
      break;
    default:
      return assertNever(key);
  }
  return raw?.trim().toLowerCase() === BYTEPLUS_MODELARK_PROVIDER
    ? BYTEPLUS_MODELARK_PROVIDER
    : 'fal';
}

function readAdminOnly(profile: BytePlusSeedanceProfile): boolean {
  const key = profile.routing.adminOnlyKey;
  let raw: string | undefined;
  switch (key) {
    case 'SEEDANCE_2_BYTEPLUS_ADMIN_ONLY':
      raw = ENV.SEEDANCE_2_BYTEPLUS_ADMIN_ONLY ?? 'true';
      break;
    case 'SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY':
      raw = ENV.SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY ?? 'true';
      break;
    case 'SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY':
      raw = ENV.SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY ?? 'false';
      break;
    default:
      return assertNever(key);
  }
  return envFlagEnabled(raw);
}

function readAllowedModes(profile: BytePlusSeedanceProfile): Mode[] {
  const key = profile.routing.allowedModesKey;
  let raw: string | undefined;
  switch (key) {
    case 'SEEDANCE_2_BYTEPLUS_MODES':
      raw = ENV.SEEDANCE_2_BYTEPLUS_MODES;
      break;
    case 'SEEDANCE_FAST_BYTEPLUS_MODES':
      raw = ENV.SEEDANCE_FAST_BYTEPLUS_MODES;
      break;
    case 'SEEDANCE_MINI_BYTEPLUS_MODES':
      raw = ENV.SEEDANCE_MINI_BYTEPLUS_MODES;
      break;
    default:
      return assertNever(key);
  }
  return allowedBytePlusModes(raw, profile.supportedModes);
}
```

Add the nullable routing and strict route-preflight functions:

```ts
export function shouldRouteSeedanceEngineToBytePlus(
  engineId: string | null | undefined
): boolean {
  const profile = getBytePlusSeedanceProfile(engineId);
  return Boolean(
    profile &&
      (profile.routing.alwaysDirect ||
        readProviderOverride(profile.routing.providerOverrideKey) ===
          BYTEPLUS_MODELARK_PROVIDER)
  );
}

export function isBytePlusSeedanceAdminOnly(
  engineId: string | null | undefined
): boolean {
  const profile = getBytePlusSeedanceProfile(engineId);
  return profile ? readAdminOnly(profile) : false;
}

export function resolveBytePlusSeedanceRouteProfile(
  engineId: string | null | undefined,
  declaredProvider: string | null | undefined
): BytePlusSeedanceProfile | null {
  const profile = getBytePlusSeedanceProfile(engineId);
  const explicitlyDeclared =
    declaredProvider?.trim().toLowerCase() === BYTEPLUS_MODELARK_PROVIDER;
  const routed = shouldRouteSeedanceEngineToBytePlus(engineId);
  if (!explicitlyDeclared && !routed) return null;
  return profile ?? requireBytePlusSeedanceProfile(engineId);
}
```

Implement compatibility wrappers without discarding their `engineId`
predicates. Use these exact forms for the three routing wrappers and keep
`isPublicSeedanceBytePlusEngine` limited to public IDs:

```ts
export function shouldRoutePublicSeedanceToBytePlus(
  engineId: string | null | undefined
): boolean {
  return isPublicSeedanceEngine(engineId) &&
    shouldRouteSeedanceEngineToBytePlus(engineId);
}

export function shouldRoutePublicSeedanceFastToBytePlus(
  engineId: string | null | undefined
): boolean {
  return isPublicSeedanceFastEngine(engineId) &&
    shouldRouteSeedanceEngineToBytePlus(engineId);
}

export function shouldRoutePublicSeedanceMiniToBytePlus(
  engineId: string | null | undefined
): boolean {
  return isPublicSeedanceMiniEngine(engineId) &&
    shouldRouteSeedanceEngineToBytePlus(engineId);
}

export function isPublicSeedanceBytePlusEngine(
  engineId: string | null | undefined
): boolean {
  return (
    isPublicSeedanceEngine(engineId) ||
    isPublicSeedanceFastEngine(engineId) ||
    isPublicSeedanceMiniEngine(engineId)
  ) && shouldRouteSeedanceEngineToBytePlus(engineId);
}
```

Retain the existing provider-override, admin-only, and mode-allowed named exports as fixed-profile wrappers because external tests and scripts may import them. Make these request-building helpers strict:

```ts
export function getBytePlusSeedanceAllowedModes(engineId: string | null | undefined): Mode[] {
  return readAllowedModes(requireBytePlusSeedanceProfile(engineId));
}

export function getBytePlusSeedanceAllowedResolutions(
  engineId: string | null | undefined
): Resolution[] {
  return [...requireBytePlusSeedanceProfile(engineId).resolutions];
}

export function getBytePlusSeedanceAllowedAspectRatios(
  engineId: string | null | undefined
): AspectRatio[] {
  return [...requireBytePlusSeedanceProfile(engineId).aspectRatios];
}

export function getBytePlusSeedanceDurationOptions(
  engineId: string | null | undefined
): readonly number[] {
  return requireBytePlusSeedanceProfile(engineId).durationOptions;
}

export function getBytePlusSeedanceGeneratedAudio(
  engineId: string | null | undefined
): boolean {
  return requireBytePlusSeedanceProfile(engineId).generatedAudio;
}

export function resolveBytePlusSeedanceModelId(
  engineId: string | null | undefined,
  config: Record<
    'seedanceModelId' | 'seedanceFastModelId' | 'seedanceMiniModelId',
    string
  >
): string {
  const profile = requireBytePlusSeedanceProfile(engineId);
  const modelId = config[profile.modelConfigKey]?.trim();
  if (!modelId) {
    throw new BytePlusModelArkError('BytePlus Seedance model ID is not configured.', {
      status: 503,
      code: 'BYTEPLUS_MODEL_ID_MISSING',
    });
  }
  return modelId;
}
```

Because `frontend/src/server/engines.ts` calls `applyBytePlusSeedanceRuntimeOptions` for every engine, use this exact prologue so unrelated engines remain unchanged while an explicit BytePlus request for an unknown engine fails:

```ts
const discoveredProfile = getBytePlusSeedanceProfile(engine.id);
const provider =
  options?.provider ??
  (discoveredProfile
    ? discoveredProfile.routing.providerOverrideKey
      ? readProviderOverride(discoveredProfile.routing.providerOverrideKey)
      : discoveredProfile.routing.alwaysDirect
        ? BYTEPLUS_MODELARK_PROVIDER
        : 'fal'
    : 'fal');
if (provider !== BYTEPLUS_MODELARK_PROVIDER) {
  return engine;
}
const profile =
  discoveredProfile ?? requireBytePlusSeedanceProfile(engine.id);
```

Create mutable API values before the existing transformation:

```ts
const resolutions: Resolution[] = [...profile.resolutions];
const aspectRatios: AspectRatio[] = [...profile.aspectRatios];
const durationOptions = profile.durationOptions;
```

Pass `aspectRatios` into `filterInputFieldsForModes` as a new mutable parameter and replace that helper's hard-coded aspect-ratio assignment with the passed value. Return `resolutions`, `aspectRatios`, `fps: [profile.framesPerSecond]`, and `audio: profile.generatedAudio`. Preserve `motionControls: true`, the current mode-cap transformation, and all existing field-copy behavior.
Set `maxDurationSec` and each duration-field maximum to
`durationOptions[durationOptions.length - 1]`; do not retain a literal `15`.
Use `profile.supportedModes` when filtering `options.allowedModes`.

Delete the moved implementations and now-unused imports from
`byteplus-modelark.ts`, then re-export the policy API from the facade. The
facade must remain below 430 lines.

- [ ] **Step 4: Put profile selection and model configuration before billing**

In `route-context.ts`, after engine lookup but before any request options,
user lookup, pricing, or job creation, resolve the profile:

```ts
let bytePlusProfile: BytePlusSeedanceProfile | null;
try {
  bytePlusProfile = resolveBytePlusSeedanceRouteProfile(
    engine.id,
    engine.providerMeta?.provider
  );
  if (bytePlusProfile) {
    resolveBytePlusSeedanceModelId(engine.id, getBytePlusArkConfig());
  }
} catch (error) {
  if (error instanceof BytePlusModelArkError) {
    return {
      ok: false,
      status: error.code === 'BYTEPLUS_ENGINE_PROFILE_MISSING' ? 400 : 503,
      body: {
        ok: false,
        error: error.code ?? 'BYTEPLUS_PROFILE_PREFLIGHT_FAILED',
        message:
          error.code === 'BYTEPLUS_ENGINE_PROFILE_MISSING'
            ? 'This engine is not configured for BytePlus.'
            : 'This engine is temporarily unavailable.',
      },
    };
  }
  throw error;
}
const isBytePlusV1a = bytePlusProfile !== null;
```

Keep the hidden-engine lookup allowlist explicitly limited to
`isBytePlusSeedanceFastEngine`. Replace the nested admin branch with:

```ts
const bytePlusRequiresAdmin =
  isBytePlusV1a && isBytePlusSeedanceAdminOnly(engine.id);
```

Short-circuit the strict mode lookup so non-BytePlus engines never call it:

```ts
if (
  isBytePlusV1a &&
  !getBytePlusSeedanceAllowedModes(engine.id).includes(mode)
) {
  return {
    ok: false,
    status: 400,
    body: {
      ok: false,
      error: 'This Seedance route only supports the configured modes.',
    },
  };
}
```

Add a source-order assertion in `tests/generate-route-context.test.ts` proving
`resolveGenerateRouteContext` is called before
`resolveGenerateBillingPreflight` in `route.ts`. Together with the pure
unknown-declared-provider test, this locks the pre-billing failure.

- [ ] **Step 5: Pass all profile capabilities through request and payload validation**

In `request-options-byteplus.ts`, require the profile once and validate
duration, resolution, and aspect ratio against its arrays. Extend the success
result with `generatedAudio: profile.generatedAudio`. In `request-options.ts`,
replace the hard-coded audio default with:

```ts
audioEnabled = bytePlusResult.generatedAudio
  ? audioEnabled ?? true
  : false;
```

Extend `buildBytePlusSeedancePayload` with required-by-submission optional
arguments:

```ts
allowedModes?: readonly Mode[];
allowedAspectRatios?: readonly AspectRatio[];
```

Use those values when supplied; keep the current constants only as direct-call
compatibility defaults. In `byteplus-submission.ts`, require the profile at the
top of the guarded `try`, set:

```ts
const generateAudio =
  profile.generatedAudio && params.audioEnabled !== false;
```

and pass `profile.supportedModes`, `profile.aspectRatios`,
the result of `getBytePlusSeedanceAllowedResolutionsFn(params.engineId)`, and
the result of `getBytePlusSeedanceDurationOptionsFn(params.engineId)` to the
payload builder. Keep those two injected dependency seams; their production
defaults are now profile-backed. Update the existing exact-payload assertions
in `tests/generate-byteplus-submission.test.ts` to include
`allowedModes` and `allowedAspectRatios`, while retaining the current injected
resolution expectation, duration expectation, and `generateAudio`.

- [ ] **Step 6: Run routing, request-option, submission, and profile tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/byteplus-seedance-profiles.test.ts \
  tests/byteplus-provider-architecture.test.ts \
  tests/generate-route-context.test.ts \
  tests/generate-request-options.test.ts \
  tests/generate-byteplus-submission.test.ts
```

Expected: PASS, including existing Standard/Fast/Mini route and option assertions.

- [ ] **Step 7: Commit routing, runtime, and pre-billing selection**

```bash
git add \
  frontend/src/server/video-providers/byteplus-modelark-profile-policy.ts \
  frontend/src/server/video-providers/byteplus-modelark.ts \
  frontend/src/server/video-providers/byteplus-modelark-payload.ts \
  frontend/app/api/generate/_lib/request-options-byteplus.ts \
  frontend/app/api/generate/_lib/request-options.ts \
  frontend/app/api/generate/_lib/byteplus-submission.ts \
  frontend/app/api/generate/_lib/route-context.ts \
  tests/byteplus-seedance-profiles.test.ts \
  tests/byteplus-provider-architecture.test.ts \
  tests/generate-route-context.test.ts \
  tests/generate-request-options.test.ts \
  tests/generate-byteplus-submission.test.ts
git commit -m "refactor: route BytePlus Seedance through profiles"
```

### Task 3: Make BytePlus accounting select an explicit pricing profile

**Files:**
- Modify: `frontend/server/byteplus-accounting.ts`
- Modify: `tests/seedance-2-pricing.test.ts`

**Interfaces:**
- Consumes: `requireBytePlusSeedanceProfile(engineId).pricingProfileKey`.
- Produces: unchanged `getBytePlusUnitPriceUsdPer1kTokens(engineId, billingInputType, resolution): number`, now throwing `BYTEPLUS_ENGINE_PROFILE_MISSING` for unknown IDs; `expectedBytePlusTokens` also derives FPS and valid resolution/aspect defaults from the explicit profile.

- [ ] **Step 1: Add failing pricing parity and rejection tests**

In `tests/seedance-2-pricing.test.ts`, add the accounting import, retain every current expected amount, and add:

```ts
import { getBytePlusUnitPriceUsdPer1kTokens } from '../frontend/server/byteplus-accounting';

test('BytePlus pricing fails closed for an unknown Seedance engine', () => {
  assert.throws(
    () => getBytePlusUnitPriceUsdPer1kTokens('seedance-2-5', 'no_video_input', '720p'),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code === 'BYTEPLUS_ENGINE_PROFILE_MISSING'
  );
});

test('hidden direct Fast keeps the current Fast unit rate', () => {
  assert.equal(
    getBytePlusUnitPriceUsdPer1kTokens('seedance-2-0-fast-byteplus', 'no_video_input', '720p'),
    getBytePlusUnitPriceUsdPer1kTokens('seedance-2-0-fast', 'no_video_input', '720p')
  );
});

test('BytePlus token estimation also fails closed for an unknown profile', () => {
  assert.throws(
    () =>
      expectedBytePlusTokens({
        engine_id: 'seedance-2-5',
        duration_sec: 5,
        settings_snapshot: {
          core: { resolution: '720p', aspectRatio: '16:9' },
        },
      }),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code ===
        'BYTEPLUS_ENGINE_PROFILE_MISSING'
  );
});
```

Add `engine_id: 'seedance-2-0-fast'` to the existing
`expectedBytePlusTokens` test inputs.

- [ ] **Step 2: Run the focused pricing test and verify the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-pricing.test.ts
```

Expected: FAIL because `seedance-2-5` returns `0.0056` instead of throwing.

- [ ] **Step 3: Dispatch on the explicit pricing key**

First change `expectedBytePlusTokens` to accept
`Pick<BytePlusPendingJob, 'engine_id' | 'duration_sec' | 'settings_snapshot'>`.
Require its profile, select stored resolution/aspect only when the profile
allows them, fall back to `720p`/`16:9` when those are allowed (otherwise the
first profile value), and multiply by `profile.framesPerSecond` instead of
literal `24`. Throw `BYTEPLUS_ACCOUNTING_DIMENSIONS_MISSING` if the selected
profile dimensions are absent from `BYTEPLUS_TOKEN_DIMENSIONS`.

Use this selection inside the function:

```ts
const profile = requireBytePlusSeedanceProfile(job.engine_id);
const settings = isRecord(job.settings_snapshot) ? job.settings_snapshot : {};
const core = isRecord(settings.core) ? settings.core : {};
const requestedResolution =
  typeof core.resolution === 'string' ? core.resolution : null;
const requestedAspectRatio =
  typeof core.aspectRatio === 'string' ? core.aspectRatio : null;
const resolution = profile.resolutions.includes(requestedResolution as never)
  ? requestedResolution!
  : profile.resolutions.includes('720p')
    ? '720p'
    : profile.resolutions[0];
const aspectRatio = profile.aspectRatios.includes(requestedAspectRatio as never)
  ? requestedAspectRatio!
  : profile.aspectRatios.includes('16:9')
    ? '16:9'
    : profile.aspectRatios[0];
const dimensions =
  resolution && aspectRatio
    ? BYTEPLUS_TOKEN_DIMENSIONS[resolution]?.[aspectRatio]
    : undefined;
if (!dimensions) {
  throw new BytePlusModelArkError(
    'BytePlus accounting dimensions are not configured for this profile.',
    { status: 500, code: 'BYTEPLUS_ACCOUNTING_DIMENSIONS_MISSING' }
  );
}
return (
  dimensions.width *
  dimensions.height *
  Math.max(1, Math.round(job.duration_sec)) *
  profile.framesPerSecond
) / 1024;
```

Then replace engine-ID pricing branching with an exhaustive switch:

```ts
const pricingProfileKey = requireBytePlusSeedanceProfile(engineId).pricingProfileKey;

switch (pricingProfileKey) {
  case 'standard':
    if ((resolution ?? '').trim().toLowerCase() === '4k') {
      return billingInputType === 'video_input'
        ? BYTEPLUS_STANDARD_4K_VIDEO_INPUT_UNIT_PRICE_USD_PER_1K_TOKENS
        : BYTEPLUS_STANDARD_4K_NO_VIDEO_INPUT_UNIT_PRICE_USD_PER_1K_TOKENS;
    }
    return BYTEPLUS_STANDARD_UNIT_PRICE_USD_PER_1K_TOKENS;
  case 'mini':
    return billingInputType === 'video_input'
      ? BYTEPLUS_MINI_VIDEO_INPUT_UNIT_PRICE_USD_PER_1K_TOKENS
      : BYTEPLUS_MINI_NO_VIDEO_INPUT_UNIT_PRICE_USD_PER_1K_TOKENS;
  case 'fast':
    return BYTEPLUS_FAST_UNIT_PRICE_USD_PER_1K_TOKENS;
  default: {
    const unsupportedProfile: never = pricingProfileKey;
    throw new BytePlusModelArkError(
      `Unsupported BytePlus pricing profile: ${String(unsupportedProfile)}`,
      { status: 500, code: 'BYTEPLUS_PRICING_PROFILE_INVALID' }
    );
  }
}
```

Import `requireBytePlusSeedanceProfile` and `BytePlusModelArkError` from the
provider module. Do not change any numeric constant or token calculation.

- [ ] **Step 4: Run focused pricing and polling/accounting tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/seedance-2-pricing.test.ts \
  tests/byteplus-provider-architecture.test.ts
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
```

Expected: all tests and all three pricing guards PASS with no baseline diff.

- [ ] **Step 5: Commit accounting strictness**

```bash
git add frontend/server/byteplus-accounting.ts tests/seedance-2-pricing.test.ts
git commit -m "fix: fail closed on unknown BytePlus pricing"
```

### Task 4: Prove defense-in-depth submission failure and safe messaging

**Files:**
- Modify: `frontend/app/api/generate/_lib/byteplus-submission.ts`
- Modify: `tests/generate-byteplus-submission.test.ts`

**Interfaces:**
- Consumes: the Task 2 submission guard plus existing failure/rollback handling.
- Produces: direct callers with an unknown engine still stop before model config,
  payload construction, or `createSeedanceFastTask`, roll back any pre-existing
  receipt, and receive an explicit configuration-safe message. The normal route
  already fails before billing in Task 2.

- [ ] **Step 1: Add the failing direct-call defense integration test**

Add to `tests/generate-byteplus-submission.test.ts`:

```ts
test('unknown BytePlus Seedance engine fails before provider submission and rolls back', async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  let configReads = 0;
  let payloadBuilds = 0;
  let clientRequests = 0;
  let rollbacks = 0;

  try {
    const result = await submitBytePlusGenerateTask({
      ...baseParams,
      engineId: 'seedance-2-5',
      engineLabel: 'Seedance 2.5',
      pendingReceipt,
      deps: {
        getBytePlusArkConfigFn: () => {
          configReads += 1;
          return ({
            seedanceModelId: 'standard-id',
            seedanceFastModelId: 'fast-id',
            seedanceMiniModelId: 'mini-id',
          }) as never;
        },
        buildBytePlusSeedancePayloadFn: (payload) => {
          payloadBuilds += 1;
          return payload;
        },
        getBytePlusModelArkClientFn: () => ({
          createSeedanceFastTask: async () => {
            clientRequests += 1;
            return { providerJobId: 'must_not_exist', status: 'queued' };
          },
        }),
        scrubBytePlusErrorFn: () => 'unsupported profile',
        queryFn: async () => undefined,
        rollbackPendingPaymentFn: async () => {
          rollbacks += 1;
        },
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'BYTEPLUS_ENGINE_PROFILE_MISSING');
    assert.equal(
      result.body.message,
      'This engine is not configured for BytePlus.'
    );
    assert.equal(configReads, 0);
    assert.equal(payloadBuilds, 0);
    assert.equal(clientRequests, 0);
    assert.equal(rollbacks, 1);
  } finally {
    console.warn = originalWarn;
  }
});
```

- [ ] **Step 2: Run the submission test and verify the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/generate-byteplus-submission.test.ts
```

Expected: FAIL until the explicit profile error keeps its safe configuration
message and HTTP 400 mapping. Provider config, payload construction, and client
request counts must remain zero.

- [ ] **Step 3: Map the profile guard explicitly in the existing catch**

Keep the Task 2 `requireBytePlusSeedanceProfile` call as the first statement
inside the guarded `try`. In the catch block, map its code before using the
generic provider-message mapper:

```ts
const failureMessage =
  errorCode === 'BYTEPLUS_ENGINE_PROFILE_MISSING'
    ? 'This engine is not configured for BytePlus.'
    : toUserFacingFailureMessage(
        getBytePlusUserSafeErrorMessageFn(providerMessage)
      );
const responseStatus =
  error instanceof BytePlusModelArkError && error.code === 'BYTEPLUS_ENGINE_PROFILE_MISSING'
    ? 400
    : providerStatus && providerStatus >= 400 && providerStatus < 500
      ? 502
      : 503;
```

Use `status: responseStatus` in the existing failure return and keep
`body.error` equal to `errorCode` plus `body.message` equal to
`failureMessage`. Do not stub the safe-message mapper in this test; the explicit
code branch is the production behavior under test.

- [ ] **Step 4: Run submission and route regression tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/generate-byteplus-submission.test.ts \
  tests/generate-route-context.test.ts \
  tests/generate-request-options.test.ts \
  tests/byteplus-seedance-profiles.test.ts
```

Expected: PASS; the unknown-engine test records zero payload builds and zero provider requests.

- [ ] **Step 5: Commit submission fail-closed behavior**

```bash
git add \
  frontend/app/api/generate/_lib/byteplus-submission.ts \
  tests/generate-byteplus-submission.test.ts
git commit -m "fix: block unknown BytePlus submissions"
```

### Task 5: Run the BytePlus release gate

**Files:**
- Verify only; modify files only to correct failures attributable to Tasks 1–4.

**Interfaces:**
- Consumes: all profile, routing, accounting, and submission changes.
- Produces: fresh verification evidence for the BytePlus sub-project.

- [ ] **Step 1: Run the complete focused suite**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/byteplus-seedance-profiles.test.ts \
  tests/byteplus-provider-architecture.test.ts \
  tests/generate-byteplus-submission.test.ts \
  tests/generate-request-options.test.ts \
  tests/generate-route-context.test.ts \
  tests/seedance-2-pricing.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 2: Run repository policy checks**

```bash
pnpm model:registry:check
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
npm --prefix frontend run lint
npm run lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
git diff --check
```

Expected: every command exits 0; model registry and pricing projections remain unchanged.

- [ ] **Step 3: Inspect the final diff for forbidden Seedance 2.5 runtime facts**

```bash
BYTEPLUS_BASE_SHA="$(
  git rev-parse "$(
    git log --format=%H \
      --grep='^refactor: add explicit BytePlus Seedance profiles$' \
      -n 1
  )^"
)"
git diff "$BYTEPLUS_BASE_SHA"..HEAD -- \
  frontend/src/server/video-providers \
  frontend/server/byteplus-accounting.ts \
  frontend/app/api/generate/_lib \
  frontend/config
if rg -n "seedance-2-5|dreamina-seedance-2-5" \
  frontend/src frontend/server frontend/app frontend/config; then
  echo "Forbidden Seedance 2.5 runtime fact found"
  exit 1
fi
```

Expected: the diff contains only profile/refactor behavior for current engines, and `rg` returns no Seedance 2.5 runtime or provider ID.

- [ ] **Step 4: Commit verification-only corrections if the gate required code changes**

If a gate failure required a scoped correction, make the correction and repeat
Task 5 Steps 1–3 in full. Do not commit until every repeated command is green.
Then stage only those correction files:

```bash
git add \
  frontend/src/server/video-providers/byteplus-modelark-profiles.ts \
  frontend/src/server/video-providers/byteplus-modelark-profile-policy.ts \
  frontend/src/server/video-providers/byteplus-modelark.ts \
  frontend/src/server/video-providers/byteplus-modelark-payload.ts \
  frontend/server/byteplus-accounting.ts \
  frontend/app/api/generate/_lib/request-options-byteplus.ts \
  frontend/app/api/generate/_lib/request-options.ts \
  frontend/app/api/generate/_lib/route-context.ts \
  frontend/app/api/generate/_lib/byteplus-submission.ts \
  tests/byteplus-seedance-profiles.test.ts \
  tests/byteplus-provider-architecture.test.ts \
  tests/generate-route-context.test.ts \
  tests/generate-request-options.test.ts \
  tests/generate-byteplus-submission.test.ts \
  tests/seedance-2-pricing.test.ts
git commit -m "test: complete BytePlus profile verification"
```

If no correction was needed, do not create an empty commit.

- [ ] **Step 5: Inspect the final verified commit range**

```bash
BYTEPLUS_BASE_SHA="$(
  git rev-parse "$(
    git log --format=%H \
      --grep='^refactor: add explicit BytePlus Seedance profiles$' \
      -n 1
  )^"
)"
git diff --check "$BYTEPLUS_BASE_SHA"..HEAD
git diff "$BYTEPLUS_BASE_SHA"..HEAD -- \
  frontend/src/server/video-providers \
  frontend/server/byteplus-accounting.ts \
  frontend/app/api/generate/_lib \
  frontend/config
if rg -n "seedance-2-5|dreamina-seedance-2-5" \
  frontend/src frontend/server frontend/app frontend/config; then
  echo "Forbidden Seedance 2.5 runtime fact found"
  exit 1
fi
```

Expected: the committed range is whitespace-clean, contains only the verified
profile/refactor behavior for current engines, and contains no Seedance 2.5
runtime or provider fact.
