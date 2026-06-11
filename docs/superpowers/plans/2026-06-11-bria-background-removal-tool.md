# Bria Video Background Removal Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready video background removal tool powered by Bria VRMBG 3.0, with a signed-in workspace, queued studio processing, paid realtime preview, billing, persistence, library reuse, and complete marketing surfaces.

**Architecture:** Add a dedicated `background-removal` tool surface instead of folding this into `upscale`. Keep server-only fal calls in `frontend/src/server/tools/background-removal*`, keep client workspace code in `frontend/src/components/tools/background-removal`, keep localized marketing routes as thin orchestrators, and update billing/job/media surface contracts explicitly.

**Tech Stack:** Next.js App Router, React client components, `@fal-ai/client`, SWR, Supabase auth, wallet billing, Neon/Postgres schema helpers and migrations, existing media library/job APIs, localized message dictionaries.

---

## Provider References Verified On 2026-06-11

- Bria queued model: `bria/video/background-removal/v3`.
  - Input: `video_url`, `background_color`, `output_container_and_codec`, `preserve_audio`.
  - Output: `video`, `request_id`.
  - Provider price shown by fal: `$0.00425` per second.
  - Docs: `https://fal.ai/models/bria/video/background-removal/v3/api`
- Bria realtime model: `bria/video/background-removal/realtime`.
  - Input: `background_type`, `background_color`, `blur_strength`, `background_image_url`, webcam/WebRTC media.
  - Output is streamed over realtime connection.
  - Provider price shown by fal: `$0.00425` per second.
  - Docs: `https://fal.ai/models/bria/video/background-removal/realtime/api`
- fal realtime token docs:
  - Generate short-lived tokens server-side with `POST https://rest.fal.ai/tokens/realtime`.
  - Protect the token endpoint with app auth.
  - Docs: `https://fal.ai/docs/documentation/model-apis/inference/real-time`

## Product Scope

Ship one user-facing tool:

- Public landing: `/tools/background-removal`
- Workspace route: `/app/tools/background-removal`
- API route: `/api/tools/background-removal`
- Realtime paid session route: `/api/tools/background-removal/realtime-session`

Modes:

- **Studio mode:** user uploads or selects a saved video, chooses transparent/solid background, output codec, audio preservation, sees exact estimated price, runs queued Bria v3 job, compares source/result, saves/downloads output.
- **Live preview mode:** user starts a prepaid realtime session, grants webcam access, chooses color/image/blur background, previews the processed stream, and the client closes the connection when purchased seconds expire.

Non-goals for this plan:

- Do not add the Bria endpoints to the generic video generation engine picker.
- Do not expose `FAL_KEY` or long-lived fal credentials to the browser.
- Do not implement AI-generated background replacement in this first version.
- Do not support anonymous generation; both modes require auth and wallet billing.

## File Structure Map

Create:

- `frontend/types/tools-background-removal.ts`
- `frontend/src/config/tools-background-removal-engines.ts`
- `frontend/src/lib/tools-background-removal.ts`
- `frontend/src/server/tools/background-removal-errors.ts`
- `frontend/src/server/tools/background-removal-request-utils.ts`
- `frontend/src/server/tools/background-removal-pricing-context.ts`
- `frontend/src/server/tools/background-removal-job-persistence.ts`
- `frontend/src/server/tools/background-removal-output-persistence.ts`
- `frontend/src/server/tools/background-removal.ts`
- `frontend/app/api/tools/background-removal/route.ts`
- `frontend/app/api/tools/background-removal/realtime-session/route.ts`
- `frontend/app/(core)/(workspace)/app/tools/background-removal/page.tsx`
- `frontend/app/tools/background-removal/page.tsx`
- `frontend/app/(localized)/[locale]/(marketing)/tools/background-removal/page.tsx`
- `frontend/src/components/tools/BackgroundRemovalWorkspace.tsx`
- `frontend/src/components/tools/BackgroundRemovalLandingPage.tsx`
- `frontend/src/components/tools/background-removal/_lib/background-removal-workspace-copy.ts`
- `frontend/src/components/tools/background-removal/_lib/background-removal-workspace-types.ts`
- `frontend/src/components/tools/background-removal/_lib/background-removal-workspace-helpers.ts`
- `frontend/src/components/tools/background-removal/_hooks/useBackgroundRemovalSourceMedia.ts`
- `frontend/src/components/tools/background-removal/_hooks/useBackgroundRemovalPricingPreview.ts`
- `frontend/src/components/tools/background-removal/_hooks/useBackgroundRemovalGenerationRunner.ts`
- `frontend/src/components/tools/background-removal/_hooks/useBackgroundRemovalRecentJobs.ts`
- `frontend/src/components/tools/background-removal/_hooks/useBackgroundRemovalRecentActions.ts`
- `frontend/src/components/tools/background-removal/_hooks/useBackgroundRemovalRealtimeSession.ts`
- `frontend/src/components/tools/background-removal/_components/BackgroundRemovalSourcePanel.tsx`
- `frontend/src/components/tools/background-removal/_components/BackgroundRemovalSettingsPanel.tsx`
- `frontend/src/components/tools/background-removal/_components/BackgroundRemovalPreviewCard.tsx`
- `frontend/src/components/tools/background-removal/_components/BackgroundRemovalRecentRail.tsx`
- `frontend/src/components/tools/background-removal/_components/BackgroundRemovalRealtimePanel.tsx`
- `frontend/src/components/tools/background-removal/landing/BackgroundRemovalLandingView.tsx`
- `frontend/src/components/tools/background-removal/landing/BackgroundRemovalLandingSections.tsx`
- `frontend/src/components/tools/background-removal/landing/background-removal-landing-assets.ts`
- `tests/background-removal-tool-contract.test.ts`
- `tests/background-removal-pricing.test.ts`
- `tests/background-removal-provider.test.ts`
- `tests/background-removal-marketing-content.test.ts`
- `tests/background-removal-realtime-session.test.ts`
- `neon/migrations/26_background_removal_tool.sql`

Modify:

- `frontend/src/lib/api-generation.ts`
- `frontend/src/lib/api.ts`
- `frontend/types/billing.ts`
- `frontend/src/lib/billing-products.ts`
- `frontend/src/lib/schema/billing-products-schema.ts`
- `frontend/src/lib/schema/media-library-schema.ts`
- `frontend/src/lib/job-surface.ts`
- `frontend/src/lib/job-surface-normalize.ts`
- `frontend/server/media-library-records.ts`
- `frontend/server/media-library/assets.ts`
- `frontend/app/api/jobs/route.ts`
- `frontend/app/api/jobs/[jobId]/route.ts`
- `frontend/app/api/jobs/_lib/jobs-surface-filter.ts`
- `frontend/src/components/tools/ToolsWorkspacePage.tsx`
- `frontend/src/components/tools/ToolsMarketingHubPage.tsx`
- `frontend/config/navigation.ts`
- `frontend/messages/en.json`
- `frontend/messages/fr.json`
- `frontend/messages/es.json`
- `tests/tool-marketing-landing-architecture.test.ts`

Static assets:

- Prefer real product screenshots after implementation:
  - `frontend/public/assets/tools/background-removal-hero-app-light.webp`
  - `frontend/public/assets/tools/background-removal-hero-app-dark.webp`
- Until screenshots exist, use a neutral checkerboard/result mock generated from app UI, not provider branding.

## Task 1: Shared Contracts, Engines, And Pricing Helpers

**Files:**
- Create: `frontend/types/tools-background-removal.ts`
- Create: `frontend/src/config/tools-background-removal-engines.ts`
- Create: `frontend/src/lib/tools-background-removal.ts`
- Modify: `frontend/src/lib/api-generation.ts`
- Modify: `frontend/src/lib/api.ts`
- Test: `tests/background-removal-tool-contract.test.ts`
- Test: `tests/background-removal-pricing.test.ts`

- [ ] **Step 1: Write contract tests first**

Create `tests/background-removal-tool-contract.test.ts` with assertions for the files and exports that define the tool boundary:

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const typesPath = join(root, 'frontend/types/tools-background-removal.ts');
const configPath = join(root, 'frontend/src/config/tools-background-removal-engines.ts');
const libPath = join(root, 'frontend/src/lib/tools-background-removal.ts');
const apiGenerationPath = join(root, 'frontend/src/lib/api-generation.ts');
const apiFacadePath = join(root, 'frontend/src/lib/api.ts');

test('background removal tool exposes typed contracts and safe model ids', () => {
  assert.ok(existsSync(typesPath));
  assert.ok(existsSync(configPath));
  assert.ok(existsSync(libPath));

  const typesSource = readFileSync(typesPath, 'utf8');
  const configSource = readFileSync(configPath, 'utf8');
  const libSource = readFileSync(libPath, 'utf8');

  assert.match(typesSource, /BackgroundRemovalToolRequest/);
  assert.match(typesSource, /BackgroundRemovalRealtimeSessionRequest/);
  assert.match(configSource, /bria\/video\/background-removal\/v3/);
  assert.match(configSource, /bria\/video\/background-removal\/realtime/);
  assert.match(configSource, /BACKGROUND_REMOVAL_PROVIDER_PRICE_USD_PER_SECOND/);
  assert.match(libSource, /buildBackgroundRemovalPricingPreview/);
  assert.match(libSource, /buildBackgroundRemovalFalInput/);
  assert.doesNotMatch(libSource, /process\.env\.FAL/);
});

test('background removal client API is exported from the public API facade', () => {
  const apiGenerationSource = readFileSync(apiGenerationPath, 'utf8');
  const apiFacadeSource = readFileSync(apiFacadePath, 'utf8');

  assert.match(apiGenerationSource, /runBackgroundRemovalTool/);
  assert.match(apiGenerationSource, /startBackgroundRemovalRealtimeSession/);
  assert.match(apiFacadeSource, /runBackgroundRemovalTool/);
  assert.match(apiFacadeSource, /startBackgroundRemovalRealtimeSession/);
});
```

- [ ] **Step 2: Run the new contract test and confirm it fails**

Run:

```bash
node --test tests/background-removal-tool-contract.test.ts
```

Expected: FAIL because the new files and exports do not exist yet.

- [ ] **Step 3: Add typed request and response contracts**

Create `frontend/types/tools-background-removal.ts` with these public contracts:

```ts
export type BackgroundRemovalEngineId =
  | 'bria-video-background-removal-v3'
  | 'bria-video-background-removal-realtime';

export type BackgroundRemovalStudioBackgroundColor =
  | 'Transparent'
  | 'Black'
  | 'White'
  | 'Gray'
  | 'Red'
  | 'Green'
  | 'Blue'
  | 'Yellow'
  | 'Cyan'
  | 'Magenta'
  | 'Orange';

export type BackgroundRemovalRealtimeBackgroundColor = Exclude<
  BackgroundRemovalStudioBackgroundColor,
  'Transparent'
>;

export type BackgroundRemovalOutputCodec =
  | 'mp4_h265'
  | 'mp4_h264'
  | 'webm_vp9'
  | 'mov_h265'
  | 'mov_proresks'
  | 'mkv_h265'
  | 'mkv_h264'
  | 'mkv_vp9'
  | 'avi_h264'
  | 'gif';

export type BackgroundRemovalRealtimeBackgroundType = 'color' | 'image' | 'blur';

export interface BackgroundRemovalToolRequest {
  videoUrl: string;
  engineId?: 'bria-video-background-removal-v3';
  backgroundColor?: BackgroundRemovalStudioBackgroundColor;
  outputContainerAndCodec?: BackgroundRemovalOutputCodec;
  preserveAudio?: boolean;
  sourceJobId?: string | null;
  sourceAssetId?: string | null;
  videoWidth?: number | null;
  videoHeight?: number | null;
  durationSec?: number | null;
  fps?: number | null;
}

export interface BackgroundRemovalToolOutput {
  url: string;
  thumbUrl?: string | null;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  mimeType?: string | null;
  originUrl?: string | null;
  assetId?: string | null;
  source?: 'background-removal' | null;
  persisted?: boolean;
}

export interface BackgroundRemovalToolPricing {
  estimatedCostUsd: number;
  actualCostUsd?: number | null;
  currency?: string;
  estimatedCredits: number;
  actualCredits?: number | null;
  totalCents?: number | null;
  billingProductKey?: string | null;
  estimate?: {
    durationSec?: number | null;
    providerEstimateUsd?: number | null;
  };
}

export interface BackgroundRemovalToolResponse {
  ok: boolean;
  jobId?: string | null;
  engineId: 'bria-video-background-removal-v3';
  engineLabel: string;
  requestId?: string | null;
  providerJobId?: string | null;
  latencyMs: number;
  pricing: BackgroundRemovalToolPricing;
  output?: BackgroundRemovalToolOutput | null;
  error?: {
    code: string;
    message: string;
    detail?: unknown;
  };
}

export interface BackgroundRemovalRealtimeSessionRequest {
  engineId?: 'bria-video-background-removal-realtime';
  sessionSeconds: 30 | 60 | 120;
  backgroundType: BackgroundRemovalRealtimeBackgroundType;
  backgroundColor?: BackgroundRemovalRealtimeBackgroundColor;
  blurStrength?: number;
  backgroundImageUrl?: string | null;
}

export interface BackgroundRemovalRealtimeSessionResponse {
  ok: boolean;
  app: 'bria/video/background-removal/realtime';
  token: string;
  tokenExpirationSeconds: number;
  sessionSeconds: 30 | 60 | 120;
  jobId: string;
  engineId: 'bria-video-background-removal-realtime';
  engineLabel: string;
  pricing: BackgroundRemovalToolPricing;
  realtimeInput: {
    background_type: BackgroundRemovalRealtimeBackgroundType;
    background_color?: BackgroundRemovalRealtimeBackgroundColor;
    blur_strength?: number;
    background_image_url?: string;
  };
  error?: {
    code: string;
    message: string;
    detail?: unknown;
  };
}

export interface BackgroundRemovalToolEngineDefinition {
  id: BackgroundRemovalEngineId;
  label: string;
  description: string;
  falModelId: string;
  billingProductKey: string;
  mode: 'studio' | 'realtime';
  providerPriceUsdPerSecond: number;
}
```

- [ ] **Step 4: Add engine config**

Create `frontend/src/config/tools-background-removal-engines.ts`:

```ts
import type { BackgroundRemovalToolEngineDefinition } from '@/types/tools-background-removal';

export const BACKGROUND_REMOVAL_PROVIDER_PRICE_USD_PER_SECOND = 0.00425;
export const BACKGROUND_REMOVAL_DYNAMIC_MARGIN_MULTIPLIER = 2;
export const BACKGROUND_REMOVAL_MAX_STUDIO_DURATION_SECONDS = 60;
export const BACKGROUND_REMOVAL_REALTIME_SESSION_SECONDS = [30, 60, 120] as const;

export const BACKGROUND_REMOVAL_TOOL_ENGINES: readonly BackgroundRemovalToolEngineDefinition[] = [
  {
    id: 'bria-video-background-removal-v3',
    label: 'Bria VRMBG 3.0',
    description: 'Queued video background removal with transparent or solid-color output.',
    falModelId: 'bria/video/background-removal/v3',
    billingProductKey: 'background-removal-video-v3',
    mode: 'studio',
    providerPriceUsdPerSecond: BACKGROUND_REMOVAL_PROVIDER_PRICE_USD_PER_SECOND,
  },
  {
    id: 'bria-video-background-removal-realtime',
    label: 'Bria VRMBG 3.0 Realtime',
    description: 'Low-latency webcam background removal using fal realtime WebSockets.',
    falModelId: 'bria/video/background-removal/realtime',
    billingProductKey: 'background-removal-realtime',
    mode: 'realtime',
    providerPriceUsdPerSecond: BACKGROUND_REMOVAL_PROVIDER_PRICE_USD_PER_SECOND,
  },
] as const;

const BACKGROUND_REMOVAL_ENGINE_MAP = new Map(
  BACKGROUND_REMOVAL_TOOL_ENGINES.map((engine) => [engine.id, engine])
);

export function getBackgroundRemovalToolEngine(id?: string | null, mode: 'studio' | 'realtime' = 'studio') {
  const fallback = BACKGROUND_REMOVAL_TOOL_ENGINES.find((engine) => engine.mode === mode)!;
  if (!id) return fallback;
  const engine = BACKGROUND_REMOVAL_ENGINE_MAP.get(id as never);
  return engine?.mode === mode ? engine : fallback;
}
```

- [ ] **Step 5: Add pricing and fal input helpers**

Create `frontend/src/lib/tools-background-removal.ts` with:

```ts
import {
  BACKGROUND_REMOVAL_DYNAMIC_MARGIN_MULTIPLIER,
  BACKGROUND_REMOVAL_MAX_STUDIO_DURATION_SECONDS,
  BACKGROUND_REMOVAL_PROVIDER_PRICE_USD_PER_SECOND,
  BACKGROUND_REMOVAL_REALTIME_SESSION_SECONDS,
} from '@/config/tools-background-removal-engines';
import type {
  BackgroundRemovalOutputCodec,
  BackgroundRemovalRealtimeBackgroundColor,
  BackgroundRemovalRealtimeBackgroundType,
  BackgroundRemovalStudioBackgroundColor,
} from '@/types/tools-background-removal';

export const BACKGROUND_REMOVAL_STUDIO_COLORS: readonly BackgroundRemovalStudioBackgroundColor[] = [
  'Transparent',
  'Black',
  'White',
  'Gray',
  'Red',
  'Green',
  'Blue',
  'Yellow',
  'Cyan',
  'Magenta',
  'Orange',
] as const;

export const BACKGROUND_REMOVAL_REALTIME_COLORS: readonly BackgroundRemovalRealtimeBackgroundColor[] = [
  'Black',
  'White',
  'Gray',
  'Red',
  'Green',
  'Blue',
  'Yellow',
  'Cyan',
  'Magenta',
  'Orange',
] as const;

export const BACKGROUND_REMOVAL_OUTPUT_CODECS: readonly BackgroundRemovalOutputCodec[] = [
  'mp4_h265',
  'mp4_h264',
  'webm_vp9',
  'mov_h265',
  'mov_proresks',
  'mkv_h265',
  'mkv_h264',
  'mkv_vp9',
  'avi_h264',
  'gif',
] as const;

export function resolveStudioBackgroundColor(value?: string | null): BackgroundRemovalStudioBackgroundColor {
  return BACKGROUND_REMOVAL_STUDIO_COLORS.includes(value as BackgroundRemovalStudioBackgroundColor)
    ? (value as BackgroundRemovalStudioBackgroundColor)
    : 'Transparent';
}

export function resolveRealtimeBackgroundColor(value?: string | null): BackgroundRemovalRealtimeBackgroundColor {
  return BACKGROUND_REMOVAL_REALTIME_COLORS.includes(value as BackgroundRemovalRealtimeBackgroundColor)
    ? (value as BackgroundRemovalRealtimeBackgroundColor)
    : 'Black';
}

export function resolveOutputCodec(value?: string | null): BackgroundRemovalOutputCodec {
  return BACKGROUND_REMOVAL_OUTPUT_CODECS.includes(value as BackgroundRemovalOutputCodec)
    ? (value as BackgroundRemovalOutputCodec)
    : 'webm_vp9';
}

export function clampRealtimeBlurStrength(value?: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function resolveRealtimeBackgroundType(value?: string | null): BackgroundRemovalRealtimeBackgroundType {
  return value === 'image' || value === 'blur' ? value : 'color';
}

export function resolveRealtimeSessionSeconds(value?: number | null): 30 | 60 | 120 {
  return BACKGROUND_REMOVAL_REALTIME_SESSION_SECONDS.includes(value as 30 | 60 | 120)
    ? (value as 30 | 60 | 120)
    : 60;
}

export function estimateBackgroundRemovalCostUsd(durationSec: number): number {
  const seconds = Math.max(1, Math.ceil(durationSec));
  return Number(
    (seconds * BACKGROUND_REMOVAL_PROVIDER_PRICE_USD_PER_SECOND * BACKGROUND_REMOVAL_DYNAMIC_MARGIN_MULTIPLIER).toFixed(4)
  );
}

export function buildBackgroundRemovalPricingPreview(params: {
  unitPriceCents?: number | null;
  currency?: string | null;
  durationSec?: number | null;
}) {
  const unitPriceCents =
    typeof params.unitPriceCents === 'number' && Number.isFinite(params.unitPriceCents)
      ? Math.max(0, Math.round(params.unitPriceCents))
      : null;
  const currency = typeof params.currency === 'string' && params.currency.trim() ? params.currency.trim().toUpperCase() : 'USD';
  const durationSec =
    typeof params.durationSec === 'number' && Number.isFinite(params.durationSec) && params.durationSec > 0
      ? Math.ceil(params.durationSec)
      : null;

  if (!durationSec || typeof unitPriceCents !== 'number') {
    return {
      totalCents: unitPriceCents,
      currency,
      ready: false,
      estimate: null,
    };
  }

  const providerEstimateUsd = estimateBackgroundRemovalCostUsd(durationSec);
  const dynamicCents = Math.max(1, Math.ceil(providerEstimateUsd * 100));

  return {
    totalCents: Math.max(unitPriceCents, dynamicCents),
    currency,
    ready: true,
    estimate: {
      durationSec,
      providerEstimateUsd,
    },
  };
}

export function buildBackgroundRemovalFalInput(params: {
  videoUrl: string;
  backgroundColor?: string | null;
  outputCodec?: string | null;
  preserveAudio?: boolean | null;
}) {
  return {
    video_url: params.videoUrl,
    background_color: resolveStudioBackgroundColor(params.backgroundColor),
    output_container_and_codec: resolveOutputCodec(params.outputCodec),
    preserve_audio: params.preserveAudio !== false,
  };
}

export function buildBackgroundRemovalRealtimeInput(params: {
  backgroundType?: string | null;
  backgroundColor?: string | null;
  blurStrength?: number | null;
  backgroundImageUrl?: string | null;
}) {
  const backgroundType = resolveRealtimeBackgroundType(params.backgroundType);
  const input: Record<string, unknown> = {
    background_type: backgroundType,
  };
  if (backgroundType === 'color') {
    input.background_color = resolveRealtimeBackgroundColor(params.backgroundColor);
  }
  if (backgroundType === 'blur') {
    input.blur_strength = clampRealtimeBlurStrength(params.blurStrength);
  }
  if (backgroundType === 'image' && params.backgroundImageUrl?.trim()) {
    input.background_image_url = params.backgroundImageUrl.trim();
  }
  return input;
}

export function validateBackgroundRemovalDuration(durationSec?: number | null): string | null {
  if (typeof durationSec !== 'number' || !Number.isFinite(durationSec) || durationSec <= 0) {
    return 'Video metadata is required before background removal.';
  }
  if (durationSec > BACKGROUND_REMOVAL_MAX_STUDIO_DURATION_SECONDS) {
    return `Studio background removal supports clips up to ${BACKGROUND_REMOVAL_MAX_STUDIO_DURATION_SECONDS} seconds in this release.`;
  }
  return null;
}
```

- [ ] **Step 6: Add client API wrappers**

Modify `frontend/src/lib/api-generation.ts` to add:

```ts
import type {
  BackgroundRemovalRealtimeSessionRequest,
  BackgroundRemovalRealtimeSessionResponse,
  BackgroundRemovalToolRequest,
  BackgroundRemovalToolResponse,
} from '@/types/tools-background-removal';

export async function runBackgroundRemovalTool(
  payload: BackgroundRemovalToolRequest
): Promise<BackgroundRemovalToolResponse> {
  const response = await authFetch('/api/tools/background-removal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as
    | (BackgroundRemovalToolResponse & { error?: { code?: string; message?: string; detail?: unknown } })
    | null;

  if (!data) throw new Error('Background removal response malformed');
  if (!response.ok || !data.ok) {
    const error = new Error(data.error?.message ?? `Background removal failed (${response.status})`);
    Object.assign(error, {
      code: data.error?.code ?? 'background_removal_failed',
      detail: data.error?.detail,
      status: response.status,
    });
    throw error;
  }
  return data;
}

export async function startBackgroundRemovalRealtimeSession(
  payload: BackgroundRemovalRealtimeSessionRequest
): Promise<BackgroundRemovalRealtimeSessionResponse> {
  const response = await authFetch('/api/tools/background-removal/realtime-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as
    | (BackgroundRemovalRealtimeSessionResponse & { error?: { code?: string; message?: string; detail?: unknown } })
    | null;

  if (!data) throw new Error('Realtime background removal session response malformed');
  if (!response.ok || !data.ok) {
    const error = new Error(data.error?.message ?? `Realtime session failed (${response.status})`);
    Object.assign(error, {
      code: data.error?.code ?? 'background_removal_realtime_failed',
      detail: data.error?.detail,
      status: response.status,
    });
    throw error;
  }
  return data;
}
```

Modify `frontend/src/lib/api.ts` to re-export both functions.

- [ ] **Step 7: Add pricing tests and pass them**

Create `tests/background-removal-pricing.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBackgroundRemovalPricingPreview,
  estimateBackgroundRemovalCostUsd,
  validateBackgroundRemovalDuration,
} from '../frontend/src/lib/tools-background-removal.ts';

test('background removal dynamic pricing charges double the provider rate', () => {
  assert.equal(estimateBackgroundRemovalCostUsd(10), 0.085);
  assert.equal(estimateBackgroundRemovalCostUsd(10.1), 0.0935);

  const preview = buildBackgroundRemovalPricingPreview({
    unitPriceCents: 5,
    currency: 'usd',
    durationSec: 10,
  });
  assert.equal(preview.ready, true);
  assert.equal(preview.currency, 'USD');
  assert.equal(preview.totalCents, 9);
  assert.equal(preview.estimate?.durationSec, 10);
});

test('background removal duration validation blocks missing and oversized videos', () => {
  assert.match(validateBackgroundRemovalDuration(null) ?? '', /metadata is required/);
  assert.equal(validateBackgroundRemovalDuration(30), null);
  assert.match(validateBackgroundRemovalDuration(61) ?? '', /up to 60 seconds/);
});
```

Run:

```bash
node --test tests/background-removal-tool-contract.test.ts tests/background-removal-pricing.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/types/tools-background-removal.ts frontend/src/config/tools-background-removal-engines.ts frontend/src/lib/tools-background-removal.ts frontend/src/lib/api-generation.ts frontend/src/lib/api.ts tests/background-removal-tool-contract.test.ts tests/background-removal-pricing.test.ts
git commit -m "feat: add background removal tool contracts"
```

## Task 2: Surface, Billing, Media Library, And Jobs Contract

**Files:**
- Create: `neon/migrations/26_background_removal_tool.sql`
- Modify: `frontend/types/billing.ts`
- Modify: `frontend/src/lib/billing-products.ts`
- Modify: `frontend/src/lib/schema/billing-products-schema.ts`
- Modify: `frontend/src/lib/schema/media-library-schema.ts`
- Modify: `frontend/src/lib/job-surface.ts`
- Modify: `frontend/src/lib/job-surface-normalize.ts`
- Modify: `frontend/server/media-library-records.ts`
- Modify: `frontend/server/media-library/assets.ts`
- Modify: `frontend/app/api/jobs/route.ts`
- Modify: `frontend/app/api/jobs/[jobId]/route.ts`
- Modify: `frontend/app/api/jobs/_lib/jobs-surface-filter.ts`
- Test: `tests/background-removal-tool-contract.test.ts`

- [ ] **Step 1: Extend the contract test for the new surface**

Append to `tests/background-removal-tool-contract.test.ts`:

```ts
test('background removal is a first-class job and media surface', () => {
  const billingTypes = readFileSync(join(root, 'frontend/types/billing.ts'), 'utf8');
  const surfaceNormalize = readFileSync(join(root, 'frontend/src/lib/job-surface-normalize.ts'), 'utf8');
  const surfaceFilter = readFileSync(join(root, 'frontend/app/api/jobs/_lib/jobs-surface-filter.ts'), 'utf8');
  const mediaRecords = readFileSync(join(root, 'frontend/server/media-library-records.ts'), 'utf8');

  assert.match(billingTypes, /'background-removal'/);
  assert.match(surfaceNormalize, /background-removal/);
  assert.match(surfaceFilter, /tool_background_removal_/);
  assert.match(mediaRecords, /background-removal/);
});
```

Run:

```bash
node --test tests/background-removal-tool-contract.test.ts
```

Expected: FAIL until the surface is wired.

- [ ] **Step 2: Add the database migration**

Create `neon/migrations/26_background_removal_tool.sql`:

```sql
ALTER TABLE media_assets
DROP CONSTRAINT IF EXISTS media_assets_source_check;

ALTER TABLE media_assets
ADD CONSTRAINT media_assets_source_check
CHECK (source IN ('upload','saved_job_output','storyboard','character','angle','upscale','background-removal','import'));

INSERT INTO app_billing_products (
  product_key,
  surface,
  label,
  currency,
  unit_kind,
  unit_price_cents,
  active,
  metadata
)
VALUES
  (
    'background-removal-video-v3',
    'background-removal',
    'Background Removal Video Bria VRMBG 3.0',
    'USD',
    'run',
    5,
    TRUE,
    '{"seeded":true,"tool":"background-removal","engineId":"bria-video-background-removal-v3","dynamicPricing":true}'::jsonb
  ),
  (
    'background-removal-realtime',
    'background-removal',
    'Background Removal Realtime Bria VRMBG 3.0',
    'USD',
    'run',
    10,
    TRUE,
    '{"seeded":true,"tool":"background-removal","engineId":"bria-video-background-removal-realtime","dynamicPricing":true}'::jsonb
  )
ON CONFLICT (product_key) DO NOTHING;
```

- [ ] **Step 3: Update in-app schema helpers and billing product seeding**

Modify `frontend/src/lib/schema/billing-products-schema.ts`:

- Add the two `app_billing_products` seed rows from the migration.
- Keep `ON CONFLICT (product_key) DO NOTHING`.

Modify `frontend/src/lib/schema/media-library-schema.ts`:

- Add `'background-removal'` to both `media_assets.source` check constraints.

- [ ] **Step 4: Update TypeScript surface unions**

Modify `frontend/types/billing.ts`:

```ts
export const JOB_SURFACE_VALUES = ['video', 'image', 'storyboard', 'character', 'angle', 'audio', 'upscale', 'background-removal'] as const;
export const USER_ASSET_SOURCE_VALUES = ['upload', 'generated', 'storyboard', 'character', 'angle', 'upscale', 'background-removal'] as const;
```

Modify `frontend/src/lib/billing-products.ts` so `normalizeSurface()` accepts `background-removal`.

Modify `frontend/src/lib/job-surface-normalize.ts` so:

- `normalizeJobSurface('background-removal')` returns `background-removal`.
- `normalizeUserAssetSource('background-removal')` returns `background-removal`.

Modify `frontend/server/media-library-records.ts` so `MediaAssetSource` and `normalizeMediaAssetSource()` accept `background-removal`.

Modify `frontend/server/media-library/assets.ts` so the legacy source mapping treats `background-removal` as a real source beside `upscale`.

- [ ] **Step 5: Update job surface derivation and filtering**

Modify `frontend/src/lib/job-surface.ts`:

- Return `background-removal` when `jobId` starts with `tool_background_removal_`.
- Include `background-removal` in `isImageLikeSurface` only if the output is image-like. For this tool, outputs are videos/GIFs, so leave `isImageLikeSurface` unchanged and instead rely on surface-specific job routes.

Modify `frontend/app/api/jobs/_lib/jobs-surface-filter.ts`:

```ts
if (surface === 'background-removal') {
  return `(surface = $${directIndex} OR job_id LIKE 'tool_background_removal_%' OR settings_snapshot->>'surface' = 'background-removal')`;
}
```

Also exclude `background-removal` from the generic `image` and `video` filters the same way `upscale` is excluded, so the background removal rail owns those jobs.

Modify `frontend/app/api/jobs/route.ts` and `frontend/app/api/jobs/[jobId]/route.ts` wherever static surface exclusion lists contain `image`, `storyboard`, `character`, `angle`, `audio`, `upscale`.

- [ ] **Step 6: Run the surface contract**

Run:

```bash
node --test tests/background-removal-tool-contract.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add neon/migrations/26_background_removal_tool.sql frontend/types/billing.ts frontend/src/lib/billing-products.ts frontend/src/lib/schema/billing-products-schema.ts frontend/src/lib/schema/media-library-schema.ts frontend/src/lib/job-surface.ts frontend/src/lib/job-surface-normalize.ts frontend/server/media-library-records.ts frontend/server/media-library/assets.ts frontend/app/api/jobs/route.ts frontend/app/api/jobs/[jobId]/route.ts frontend/app/api/jobs/_lib/jobs-surface-filter.ts tests/background-removal-tool-contract.test.ts
git commit -m "feat: add background removal surface"
```

## Task 3: Studio Server Runner

**Files:**
- Create: `frontend/src/server/tools/background-removal-errors.ts`
- Create: `frontend/src/server/tools/background-removal-request-utils.ts`
- Create: `frontend/src/server/tools/background-removal-pricing-context.ts`
- Create: `frontend/src/server/tools/background-removal-job-persistence.ts`
- Create: `frontend/src/server/tools/background-removal-output-persistence.ts`
- Create: `frontend/src/server/tools/background-removal.ts`
- Test: `tests/background-removal-provider.test.ts`

- [ ] **Step 1: Write provider helper tests**

Create `tests/background-removal-provider.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBackgroundRemovalFalInput,
  buildBackgroundRemovalRealtimeInput,
} from '../frontend/src/lib/tools-background-removal.ts';
import {
  extractBackgroundRemovalOutput,
  formatBackgroundRemovalVideoMime,
  parseBackgroundRemovalRequestId,
} from '../frontend/src/server/tools/background-removal-request-utils.ts';

test('studio fal input maps MaxVideoAI controls to Bria v3 schema', () => {
  assert.deepEqual(
    buildBackgroundRemovalFalInput({
      videoUrl: 'https://example.com/source.mp4',
      backgroundColor: 'Transparent',
      outputCodec: 'webm_vp9',
      preserveAudio: false,
    }),
    {
      video_url: 'https://example.com/source.mp4',
      background_color: 'Transparent',
      output_container_and_codec: 'webm_vp9',
      preserve_audio: false,
    }
  );
});

test('realtime input emits only fields relevant to selected background type', () => {
  assert.deepEqual(buildBackgroundRemovalRealtimeInput({ backgroundType: 'blur', blurStrength: 73 }), {
    background_type: 'blur',
    blur_strength: 73,
  });
  assert.deepEqual(buildBackgroundRemovalRealtimeInput({ backgroundType: 'image', backgroundImageUrl: 'https://example.com/bg.png' }), {
    background_type: 'image',
    background_image_url: 'https://example.com/bg.png',
  });
});

test('provider output parsing supports Bria video object payloads', () => {
  const payload = {
    video: {
      url: 'https://cdn.example.com/output.webm',
      content_type: 'video/webm',
      file_name: 'output.webm',
      file_size: 123,
    },
    request_id: 'bria-123',
  };
  const output = extractBackgroundRemovalOutput(payload);
  assert.equal(output?.url, 'https://cdn.example.com/output.webm');
  assert.equal(output?.mimeType, 'video/webm');
  assert.equal(parseBackgroundRemovalRequestId(payload), 'bria-123');
  assert.equal(formatBackgroundRemovalVideoMime('mov_proresks'), 'video/quicktime');
});
```

Run:

```bash
node --test tests/background-removal-provider.test.ts
```

Expected: FAIL until server helper files exist.

- [ ] **Step 2: Implement error and request helper modules**

Create `frontend/src/server/tools/background-removal-errors.ts`:

```ts
export class BackgroundRemovalToolError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; detail?: unknown }) {
    super(message);
    this.name = 'BackgroundRemovalToolError';
    this.status = options?.status ?? 500;
    this.code = options?.code ?? 'background_removal_error';
    this.detail = options?.detail;
  }
}
```

Create `frontend/src/server/tools/background-removal-request-utils.ts` with helpers equivalent to `upscale-request-utils.ts` but scoped to this tool:

- `BACKGROUND_REMOVAL_SURFACE = 'background-removal'`
- `BACKGROUND_REMOVAL_TOOL_EVENT_NAME = 'tool_background_removal'`
- `formatBackgroundRemovalVideoMime(codec)`
- `extractBackgroundRemovalOutput(payload)`
- `parseBackgroundRemovalRequestId(payload)`
- `extractBackgroundRemovalActualCostUsd(payload)`
- `buildBackgroundRemovalPromptSummary({ backgroundColor, outputCodec, preserveAudio })`
- `buildBackgroundRemovalSettingsSnapshot({ engine, videoUrl, backgroundColor, outputCodec, preserveAudio, billingProductKey, sourceJobId, sourceAssetId, metadata })`
- `toBackgroundRemovalValidationMessage(error)`

Use the same defensive parsing style as `frontend/src/server/tools/upscale-request-utils.ts`. Do not import browser-only modules.

- [ ] **Step 3: Implement pricing context**

Create `frontend/src/server/tools/background-removal-pricing-context.ts`:

- Call `computeBillingProductSnapshot({ productKey, quantity: 1, engineId })`.
- Use `buildBackgroundRemovalPricingPreview()` with server-detected metadata duration.
- Clone the billing snapshot when dynamic cents exceed the product floor.
- Add `surface`, `billingProductKey`, `providerEstimateUsd`, `dynamicMultiplier`, and `videoMetadata` to `pricing.meta`.
- Throw `BackgroundRemovalToolError` with `code: 'pricing_error'` when pricing cannot be computed.

- [ ] **Step 4: Implement atomic job persistence**

Create `frontend/src/server/tools/background-removal-job-persistence.ts` based on `upscale-job-persistence.ts`:

- Reserve wallet in a transaction via `reserveWalletChargeInExecutor`.
- Insert `app_jobs` with:
  - `job_id = tool_background_removal_${randomUUID()}`
  - `surface = 'background-removal'`
  - `billing_product_key = background-removal-video-v3`
  - `engine_id = bria-video-background-removal-v3`
  - `status = 'pending'`
  - `payment_status = 'paid_wallet'`
  - `visibility = 'private'`
  - `indexable = FALSE`
  - `provisional = TRUE`
- Insert `fal_queue_log` events through `insertBackgroundRemovalToolEvent()`.
- Record refund receipts on provider failure with `recordBackgroundRemovalRefundReceipt()`.

- [ ] **Step 5: Implement output persistence**

Create `frontend/src/server/tools/background-removal-output-persistence.ts`:

- Fetch the provider output with a timeout based on duration.
- Upload videos via `uploadFileBuffer()`.
- Use `createUploadVideoThumbnail()` or existing video thumbnail helper for `thumbUrl`.
- Record `user_assets` with `source: 'background-removal'`.
- Return `BackgroundRemovalToolOutput` with `persisted: true`, `originUrl`, and `assetId`.
- Fall back to provider URL and log a warning if persistence fails, matching the upscale behavior.

- [ ] **Step 6: Implement the server runner**

Create `frontend/src/server/tools/background-removal.ts`:

- Import `getBackgroundRemovalToolEngine()`, `getFalClient()`, dynamic pricing helpers, job persistence helpers, output persistence helpers, `ensureReusableAsset()`, `upsertLegacyJobOutputs()`, and `query()`.
- Validate absolute `videoUrl`.
- Validate metadata duration with `validateBackgroundRemovalDuration()`.
- Create the initial job and reserve wallet before calling fal.
- Call `falClient.subscribe(engine.falModelId, { input, mode: 'polling', onEnqueue, onQueueUpdate })`.
- Extract `video` output from Bria payload.
- Persist output, update `app_jobs` to `completed`, set `video_url`, `thumb_url`, `preview_frame`, `provider_job_id`, `final_price_cents`, `pricing_snapshot`, `settings_snapshot`, `cost_breakdown_usd`, `payment_status = 'paid_wallet'`, `provisional = FALSE`.
- Upsert `job_outputs`.
- Upsert reusable media asset with source `background-removal`.
- On failure, refund wallet, mark job failed, log event, and throw `BackgroundRemovalToolError` with provider-safe message.

- [ ] **Step 7: Pass provider tests**

Run:

```bash
node --test tests/background-removal-provider.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/server/tools/background-removal-errors.ts frontend/src/server/tools/background-removal-request-utils.ts frontend/src/server/tools/background-removal-pricing-context.ts frontend/src/server/tools/background-removal-job-persistence.ts frontend/src/server/tools/background-removal-output-persistence.ts frontend/src/server/tools/background-removal.ts tests/background-removal-provider.test.ts
git commit -m "feat: add background removal server runner"
```

## Task 4: API Routes And Validation

**Files:**
- Create: `frontend/app/api/tools/background-removal/route.ts`
- Create: `frontend/app/api/tools/background-removal/realtime-session/route.ts`
- Test: `tests/background-removal-realtime-session.test.ts`

- [ ] **Step 1: Write route contract tests**

Create `tests/background-removal-realtime-session.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const studioRoute = readFileSync(join(root, 'frontend/app/api/tools/background-removal/route.ts'), 'utf8');
const realtimeRoute = readFileSync(join(root, 'frontend/app/api/tools/background-removal/realtime-session/route.ts'), 'utf8');

test('background removal routes require auth, account health, and feature flag', () => {
  for (const source of [studioRoute, realtimeRoute]) {
    assert.match(source, /FEATURES\.workflows\.toolsSection/);
    assert.match(source, /getRouteAuthContext/);
    assert.match(source, /getActiveAccountRestriction/);
    assert.match(source, /RESTRICTED_ACCOUNT_MESSAGE/);
  }
});

test('realtime session route protects fal token creation', () => {
  assert.match(realtimeRoute, /https:\/\/rest\.fal\.ai\/tokens\/realtime/);
  assert.match(realtimeRoute, /allowed_apps/);
  assert.match(realtimeRoute, /bria\/video\/background-removal\/realtime/);
  assert.doesNotMatch(realtimeRoute, /return NextResponse\.json\(\{ ok: true, token: process\.env/);
});
```

Run:

```bash
node --test tests/background-removal-realtime-session.test.ts
```

Expected: FAIL until routes exist.

- [ ] **Step 2: Add studio API route**

Create `frontend/app/api/tools/background-removal/route.ts`:

- `export const runtime = 'nodejs';`
- Parse JSON.
- Enforce `FEATURES.workflows.toolsSection`.
- Use `getRouteAuthContext(req)`.
- Reject anonymous users with `401 auth_required`.
- Reject restricted accounts with `403 account_restricted`.
- Validate `videoUrl` absolute HTTP(S).
- Validate `durationSec` exists and is <= 60 seconds.
- Normalize controls through helper functions.
- Call `runBackgroundRemovalTool({ userId, ...body })`.
- Return typed JSON.
- Map `BackgroundRemovalToolError` to its status/code/detail.

- [ ] **Step 3: Add paid realtime session route**

Create `frontend/app/api/tools/background-removal/realtime-session/route.ts`:

- `export const runtime = 'nodejs';`
- Enforce feature flag, auth, and restriction checks.
- Normalize `sessionSeconds` to `30 | 60 | 120`.
- Compute price with selected seconds and `background-removal-realtime` billing product.
- Reserve wallet and create a private `tool_background_removal_realtime_${randomUUID()}` job with status `completed` immediately after token creation. The job represents access to a prepaid realtime session, not a rendered output.
- Call:

```ts
const falTokenResponse = await fetch('https://rest.fal.ai/tokens/realtime', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Key ${process.env.FAL_KEY ?? process.env.FAL_API_KEY}`,
  },
  body: JSON.stringify({
    allowed_apps: ['bria/video/background-removal/realtime'],
    duration: sessionSeconds + 15,
  }),
});
```

- If token creation fails, refund the wallet and mark the session job failed.
- Return the token, `tokenExpirationSeconds`, session seconds, price, job id, app id, and sanitized realtime input.
- Never return the fal API key.

- [ ] **Step 4: Pass route tests**

Run:

```bash
node --test tests/background-removal-realtime-session.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/api/tools/background-removal/route.ts frontend/app/api/tools/background-removal/realtime-session/route.ts tests/background-removal-realtime-session.test.ts
git commit -m "feat: add background removal API routes"
```

## Task 5: Workspace UI

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/tools/background-removal/page.tsx`
- Create: `frontend/src/components/tools/BackgroundRemovalWorkspace.tsx`
- Create all `frontend/src/components/tools/background-removal/_lib/*`
- Create all `frontend/src/components/tools/background-removal/_hooks/*`
- Create all `frontend/src/components/tools/background-removal/_components/*`
- Modify: `frontend/src/components/tools/ToolsWorkspacePage.tsx`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Test: `tests/background-removal-tool-contract.test.ts`

- [ ] **Step 1: Extend architecture contract for workspace split**

Append to `tests/background-removal-tool-contract.test.ts`:

```ts
test('background removal workspace follows the tool workspace split', () => {
  const workspacePath = join(root, 'frontend/src/components/tools/BackgroundRemovalWorkspace.tsx');
  const copyPath = join(root, 'frontend/src/components/tools/background-removal/_lib/background-removal-workspace-copy.ts');
  const helpersPath = join(root, 'frontend/src/components/tools/background-removal/_lib/background-removal-workspace-helpers.ts');
  const runnerHookPath = join(root, 'frontend/src/components/tools/background-removal/_hooks/useBackgroundRemovalGenerationRunner.ts');
  const realtimeHookPath = join(root, 'frontend/src/components/tools/background-removal/_hooks/useBackgroundRemovalRealtimeSession.ts');

  assert.ok(existsSync(workspacePath));
  assert.ok(existsSync(copyPath));
  assert.ok(existsSync(helpersPath));
  assert.ok(existsSync(runnerHookPath));
  assert.ok(existsSync(realtimeHookPath));

  const workspaceSource = readFileSync(workspacePath, 'utf8');
  const runnerHookSource = readFileSync(runnerHookPath, 'utf8');
  const realtimeHookSource = readFileSync(realtimeHookPath, 'utf8');

  assert.match(workspaceSource, /useBackgroundRemovalSourceMedia/);
  assert.match(workspaceSource, /useBackgroundRemovalPricingPreview/);
  assert.match(workspaceSource, /useBackgroundRemovalGenerationRunner/);
  assert.match(workspaceSource, /useBackgroundRemovalRealtimeSession/);
  assert.doesNotMatch(workspaceSource, /runBackgroundRemovalTool/);
  assert.doesNotMatch(workspaceSource, /fal\.realtime\.connect/);
  assert.match(runnerHookSource, /runBackgroundRemovalTool/);
  assert.match(realtimeHookSource, /fal\.realtime\.connect/);
});
```

Run:

```bash
node --test tests/background-removal-tool-contract.test.ts
```

Expected: FAIL until workspace files exist.

- [ ] **Step 2: Add workspace route**

Create `frontend/app/(core)/(workspace)/app/tools/background-removal/page.tsx`:

```tsx
import BackgroundRemovalWorkspace from '@/components/tools/BackgroundRemovalWorkspace';

export default function BackgroundRemovalToolPage() {
  return <BackgroundRemovalWorkspace />;
}
```

- [ ] **Step 3: Add workspace copy**

Create `frontend/src/components/tools/background-removal/_lib/background-removal-workspace-copy.ts` with clear defaults:

- Tool title: "Video Background Remover"
- Source panel labels.
- Settings labels for background color, codec, preserve audio.
- Price states: loading, unavailable, metadata required, ready.
- Studio run labels: "Remove Background", "Processing..."
- Realtime labels: "Live preview", "Start 60s preview", "Stop preview", "Camera permission required", "Session ended".
- Save/download/library/recent labels.
- Auth and disabled-state labels.

Add matching `workspace.backgroundRemoval` objects to `frontend/messages/en.json`, `fr.json`, and `es.json`.

- [ ] **Step 4: Add source media hook and helpers**

Implement `useBackgroundRemovalSourceMedia.ts` using the upscale source hook pattern:

- Accept video uploads through `/api/uploads/video`.
- Accept absolute video URLs.
- Read video metadata in browser with a `video` element.
- Reject clips above 60 seconds before calling the server.
- Support library selection from uploaded/generated/background-removal videos.
- Reset result when source changes.

In helpers, include:

- `uploadSourceVideo(file: File)`
- `readBackgroundRemovalVideoMetadata(url: string)`
- `formatCurrency(amountCents, currency, locale)`
- `inferVideoMimeType(url)`
- `isTransparentOutput(codec, backgroundColor)` for preview copy.

- [ ] **Step 5: Add pricing hook**

Implement `useBackgroundRemovalPricingPreview.ts`:

- Fetch `/api/billing-products?productKey=background-removal-video-v3`.
- Use `buildBackgroundRemovalPricingPreview()`.
- Show "Add a readable video source to estimate" until metadata is known.
- Keep previous data while switching controls.

- [ ] **Step 6: Add generation runner hook**

Implement `useBackgroundRemovalGenerationRunner.ts`:

- Own the call to `runBackgroundRemovalTool`.
- Emit `tool_start`, `tool_success`, and `tool_error` client metrics if the existing tool hooks do this.
- Set result, active recent job id, user-facing messages, and trigger recent jobs mutate.
- Do not own UI rendering.

- [ ] **Step 7: Add preview UI**

Implement `BackgroundRemovalPreviewCard.tsx`:

- Shows source video when no result exists.
- Shows result video after completion.
- Supports compare mode with source/result toggle. Do not implement a pixel slider for videos in the first release unless it is already simple from `UpscalePreviewCard`.
- Shows checkerboard behind transparent WebM output.
- Provides save and download buttons.
- Provides compact metadata: duration, codec, background, preserve audio.

- [ ] **Step 8: Add realtime panel**

Implement `useBackgroundRemovalRealtimeSession.ts` and `BackgroundRemovalRealtimePanel.tsx`:

- Request camera permission only after user clicks start.
- Call `startBackgroundRemovalRealtimeSession()` to reserve wallet and get token.
- Connect using:

```ts
import { fal } from '@fal-ai/client';

const connection = fal.realtime.connect('bria/video/background-removal/realtime', {
  tokenProvider: async () => session.token,
  tokenExpirationSeconds: session.tokenExpirationSeconds,
  onResult: handleRealtimeResult,
  onError: handleRealtimeError,
  clientOnly: true,
  maxBuffering: 2,
});

connection.send(session.realtimeInput);
```

- Close the connection when timer reaches zero, when user clicks stop, and on unmount.
- Show elapsed/remaining session seconds.
- Keep live mode explicitly separate from studio output persistence; live preview does not save media in v1.

- [ ] **Step 9: Add recent jobs rail**

Implement `useBackgroundRemovalRecentJobs.ts` and `BackgroundRemovalRecentRail.tsx`:

- Use `useInfiniteJobs(12, { surface: 'background-removal' })`.
- Poll pending jobs with `getJobStatus(jobId)`.
- Show recent completed videos and failed states.
- Select recent output into the preview card.
- Support download, copy link, and save to library.

- [ ] **Step 10: Assemble `BackgroundRemovalWorkspace.tsx`**

Use the existing app shell pattern from `UpscaleWorkspace.tsx`:

- `useRequireAuth({ redirectIfLoggedOut: false })`
- `FEATURES.workflows.toolsSection` disabled state
- `HeaderBar` and `AppSidebar`
- Back link to `/app/tools`
- Hero summary card with price and run button
- Responsive layout:
  - left: source and settings
  - center: preview
  - right or lower section: live preview and recent jobs
- Keep cards at 8px to 14px radius in workspace surfaces. Avoid marketing-scale hero typography inside the app.

- [ ] **Step 11: Add tool hub card**

Modify `frontend/src/components/tools/ToolsWorkspacePage.tsx`:

- Add a fifth card for background removal.
- Use `Scissors`, `Eraser`, `Video`, or closest lucide icon.
- Link to `/app/tools/background-removal`.
- Keep the grid responsive; for `xl`, use 5 cards without forcing tiny text. If needed use `xl:grid-cols-5`; otherwise `lg:grid-cols-2 xl:grid-cols-3`.

- [ ] **Step 12: Pass workspace contract**

Run:

```bash
node --test tests/background-removal-tool-contract.test.ts
```

Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add 'frontend/app/(core)/(workspace)/app/tools/background-removal/page.tsx' frontend/src/components/tools/BackgroundRemovalWorkspace.tsx frontend/src/components/tools/background-removal frontend/src/components/tools/ToolsWorkspacePage.tsx frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json tests/background-removal-tool-contract.test.ts
git commit -m "feat: add background removal workspace"
```

## Task 6: Marketing Landing And Navigation

**Files:**
- Create: `frontend/app/tools/background-removal/page.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/tools/background-removal/page.tsx`
- Create: `frontend/src/components/tools/BackgroundRemovalLandingPage.tsx`
- Create: `frontend/src/components/tools/background-removal/landing/BackgroundRemovalLandingView.tsx`
- Create: `frontend/src/components/tools/background-removal/landing/BackgroundRemovalLandingSections.tsx`
- Create: `frontend/src/components/tools/background-removal/landing/background-removal-landing-assets.ts`
- Modify: `frontend/src/components/tools/ToolsMarketingHubPage.tsx`
- Modify: `frontend/config/navigation.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Modify: `tests/tool-marketing-landing-architecture.test.ts`
- Test: `tests/background-removal-marketing-content.test.ts`

- [ ] **Step 1: Write marketing content tests**

Create `tests/background-removal-marketing-content.test.ts`:

```ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function readLocale(locale: 'en' | 'fr' | 'es') {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), `frontend/messages/${locale}.json`), 'utf8')) as {
    toolMarketing: {
      backgroundRemoval?: {
        meta?: { title?: string; description?: string; keywords?: string[]; imageAlt?: string };
        hero?: { title?: string; body?: string; primaryCta?: string; secondaryCta?: string };
        modelGuide?: { rows?: Array<{ model?: string; bestFor?: string; price?: string; useWhen?: string }> };
        faq?: Array<{ q?: string; a?: string }>;
      };
      hub?: unknown;
    };
  };
}

test('background removal marketing copy is complete in every locale', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = readLocale(locale).toolMarketing.backgroundRemoval;
    assert.ok(copy?.meta?.title, `${locale} title`);
    assert.ok(copy?.meta?.description, `${locale} description`);
    assert.ok(copy?.meta?.keywords?.length, `${locale} keywords`);
    assert.ok(copy?.meta?.imageAlt, `${locale} image alt`);
    assert.ok(copy?.hero?.title, `${locale} hero title`);
    assert.ok(copy?.hero?.body, `${locale} hero body`);
    assert.ok(copy?.modelGuide?.rows?.some((row) => row.model?.includes('VRMBG 3.0')), `${locale} mentions VRMBG 3.0`);
    assert.ok((copy?.faq?.length ?? 0) >= 4, `${locale} FAQ`);
  }
});

test('background removal marketing copy does not expose fal branding', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = readLocale(locale).toolMarketing.backgroundRemoval;
    assert.doesNotMatch(JSON.stringify(copy).toLowerCase(), /fal(?:\.ai|-ai|\s+ai)?/);
  }
});

test('background removal landing uses shared JSON-LD helpers and app screenshots', () => {
  const wrapper = fs.readFileSync(path.join(process.cwd(), 'frontend/src/components/tools/BackgroundRemovalLandingPage.tsx'), 'utf8');
  const view = fs.readFileSync(path.join(process.cwd(), 'frontend/src/components/tools/background-removal/landing/BackgroundRemovalLandingView.tsx'), 'utf8');
  const route = fs.readFileSync(path.join(process.cwd(), 'frontend/app/(localized)/[locale]/(marketing)/tools/background-removal/page.tsx'), 'utf8');

  assert.match(wrapper, /BackgroundRemovalLandingView/);
  assert.match(view, /buildToolBreadcrumbJsonLd/);
  assert.match(view, /buildToolHowToJsonLd/);
  assert.match(route, /image: '\/assets\/tools\/background-removal-hero-app-light\.webp'/);
});
```

Run:

```bash
node --test tests/background-removal-marketing-content.test.ts
```

Expected: FAIL until marketing files/copy exist.

- [ ] **Step 2: Add localized marketing route**

Create `frontend/app/(localized)/[locale]/(marketing)/tools/background-removal/page.tsx`:

- Mirror `tools/upscale/page.tsx`.
- Import `BackgroundRemovalLandingPage`.
- Use `dictionary.toolMarketing.backgroundRemoval`.
- `englishPath: '/tools/background-removal'`.
- `image: '/assets/tools/background-removal-hero-app-light.webp'`.
- `availableLocales: ['en', 'fr', 'es']`.

Create default wrapper `frontend/app/tools/background-removal/page.tsx` mirroring existing default tool wrappers.

- [ ] **Step 3: Add thin wrapper and landing view**

Create `frontend/src/components/tools/BackgroundRemovalLandingPage.tsx`:

```tsx
import type { Dictionary } from '@/lib/i18n/types';
import { BackgroundRemovalLandingView } from './background-removal/landing/BackgroundRemovalLandingView';

type BackgroundRemovalLandingContent = Dictionary['toolMarketing']['backgroundRemoval'];

export function BackgroundRemovalLandingPage({ content }: { content: BackgroundRemovalLandingContent }) {
  return <BackgroundRemovalLandingView content={content} />;
}
```

Create `BackgroundRemovalLandingView.tsx`:

- Use `FAQSchema`.
- Use `buildMarketingServiceJsonLd`.
- Use `buildToolBreadcrumbJsonLd`, `buildToolHowToJsonLd`, and `serializeJsonLd`.
- Delegate visible sections to `BackgroundRemovalLandingSections`.
- Canonical URL: `https://maxvideoai.com/tools/background-removal`.

- [ ] **Step 4: Build landing sections**

Create `BackgroundRemovalLandingSections.tsx` with these sections:

- Hero: actual tool screenshot, direct CTA to `/app/tools/background-removal`, secondary CTA to `/tools`.
- Use cases: talking heads, product clips, ads, education/course clips, ecommerce/social assets.
- Model guide: Bria VRMBG 3.0 studio vs Bria VRMBG 3.0 realtime, price context, use when.
- Workflow: upload/select video, choose transparent/color output, preview/save/export.
- Realtime: paid live preview for webcam/background blur/image/color.
- FAQ: transparent output, audio preservation, pricing, max duration, library reuse, realtime privacy.
- Final CTA.

Keep each section component under 220 lines and split primitives if the file approaches 500 lines.

- [ ] **Step 5: Add localized copy**

Modify `frontend/messages/en.json`, `fr.json`, `es.json`:

- Add `toolMarketing.backgroundRemoval`.
- Add hub card copy in `toolMarketing.hub`.
- Add workspace route copy in `workspace.tools` for the new card.
- Add `workspace.backgroundRemoval`.

Keep provider implementation hidden from public marketing copy. Use "Bria VRMBG 3.0" but not "fal".

- [ ] **Step 6: Update public tools hub and navigation**

Modify `frontend/src/components/tools/ToolsMarketingHubPage.tsx`:

- Add background removal card.
- Link to `/tools/background-removal`.
- Keep existing hub layout stable across 4-5 cards.

Modify `frontend/config/navigation.ts`:

- Extend `toolLink` slug union to include `'background-removal'`.
- Add dropdown item `Video Background Remover`.

- [ ] **Step 7: Update marketing architecture test**

Modify `tests/tool-marketing-landing-architecture.test.ts`:

- Add background removal wrapper/view/sections/assets paths to the same thin-wrapper and JSON-LD helper assertions used for angle and character builder.
- Keep per-file line caps.

- [ ] **Step 8: Run marketing tests**

Run:

```bash
node --test tests/background-removal-marketing-content.test.ts tests/tool-marketing-landing-architecture.test.ts
npm --prefix frontend run qa:tools-locales
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/app/tools/background-removal/page.tsx 'frontend/app/(localized)/[locale]/(marketing)/tools/background-removal/page.tsx' frontend/src/components/tools/BackgroundRemovalLandingPage.tsx frontend/src/components/tools/background-removal/landing frontend/src/components/tools/ToolsMarketingHubPage.tsx frontend/config/navigation.ts frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json tests/background-removal-marketing-content.test.ts tests/tool-marketing-landing-architecture.test.ts
git commit -m "feat: add background removal marketing surfaces"
```

## Task 7: Tool Polish, Library Integration, And Admin Safety

**Files:**
- Modify: `frontend/server/media-library/assets.ts`
- Modify: `frontend/src/components/tools/background-removal/_components/BackgroundRemovalRecentRail.tsx`
- Modify: `frontend/src/components/tools/background-removal/_components/BackgroundRemovalPreviewCard.tsx`
- Modify: `frontend/src/components/tools/background-removal/_hooks/useBackgroundRemovalRecentActions.ts`
- Modify: `frontend/src/components/tools/background-removal/_hooks/useBackgroundRemovalRecentJobs.ts`
- Modify: `frontend/app/api/admin/videos/pending/route.ts` if admin surface filtering needs the new surface exclusion.
- Test: `tests/background-removal-tool-contract.test.ts`

- [ ] **Step 1: Add contract assertions for library actions**

Append assertions that recent action source is `background-removal`, save-to-library uses `kind: 'video'`, and recent jobs use `{ surface: 'background-removal' }`.

- [ ] **Step 2: Confirm media library filters include the new source**

Ensure `listLibraryAssets()` can filter `source=background-removal`.

Ensure the tool's library picker tabs include:

- All videos
- Uploaded
- Generated
- Background removal

- [ ] **Step 3: Add recent result actions**

Implement actions:

- Open/select recent output in preview.
- Download.
- Copy link.
- Save to library.

Use existing `GroupedJobCard` actions where possible.

- [ ] **Step 4: Add empty, loading, failed, and auth states**

Workspace must show:

- Auth modal when signed out.
- Disabled card when feature flag off.
- Metadata loading state for videos.
- Wallet error with required cents from server detail.
- Provider failure state with retry action.
- Realtime camera-denied state.

- [ ] **Step 5: Pass tests**

Run:

```bash
node --test tests/background-removal-tool-contract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/server/media-library/assets.ts frontend/src/components/tools/background-removal tests/background-removal-tool-contract.test.ts
git commit -m "feat: polish background removal tool library flow"
```

## Task 8: Browser QA And Screenshots

**Files:**
- Create/replace: `frontend/public/assets/tools/background-removal-hero-app-light.webp`
- Create/replace: `frontend/public/assets/tools/background-removal-hero-app-dark.webp`
- Modify: `tests/background-removal-marketing-content.test.ts` if screenshot names differ.

- [ ] **Step 1: Run local dev server**

Run:

```bash
npm --prefix frontend run dev
```

Use the next available port if `3000` is occupied.

- [ ] **Step 2: Smoke-test public marketing routes**

Open:

```txt
/tools/background-removal
/fr/outils/background-removal
/es/herramientas/background-removal
/tools
```

Check:

- Canonical URL points to `/tools/background-removal`.
- Hreflang includes en/fr/es.
- JSON-LD scripts render and do not contain malformed HTML.
- Hero text does not overlap screenshot on mobile.
- CTAs route to `/app/tools/background-removal` and `/tools`.

- [ ] **Step 3: Smoke-test workspace route**

Open:

```txt
/app/tools/background-removal
```

Check:

- Signed-out state appears without console errors.
- Signed-in state loads source/settings/preview/recent/live panels.
- Uploading a short MP4 reads duration and price.
- URL input works with an HTTPS video URL.
- Transparent WebM output displays on checkerboard.
- Black/white output displays without checkerboard.
- Save to Library writes a video asset.
- Recent rail can re-open output.

- [ ] **Step 4: Smoke-test realtime preview**

With a signed-in account and wallet balance:

- Start 30s realtime session.
- Browser asks for camera only after user clicks start.
- Timer counts down.
- Color, blur, and image background modes send sanitized input.
- Stop button closes WebSocket.
- Unmounting route closes WebSocket.
- Session cannot run past purchased seconds.

- [ ] **Step 5: Capture app screenshots**

Use Playwright or the in-app Browser to capture light and dark workspace screenshots after the UI is stable:

- Save light screenshot as `frontend/public/assets/tools/background-removal-hero-app-light.webp`.
- Save dark screenshot as `frontend/public/assets/tools/background-removal-hero-app-dark.webp`.
- Keep images inspectable; avoid blurred stock-like media.

- [ ] **Step 6: Commit**

```bash
git add frontend/public/assets/tools/background-removal-hero-app-light.webp frontend/public/assets/tools/background-removal-hero-app-dark.webp tests/background-removal-marketing-content.test.ts
git commit -m "chore: add background removal marketing screenshots"
```

## Task 9: Final Verification

- [ ] **Step 1: Run focused tests**

```bash
node --test tests/background-removal-tool-contract.test.ts tests/background-removal-pricing.test.ts tests/background-removal-provider.test.ts tests/background-removal-marketing-content.test.ts tests/background-removal-realtime-session.test.ts
node --test tests/tool-marketing-landing-architecture.test.ts tests/upscale-workspace-architecture.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run project checks**

```bash
npm --prefix frontend run lint
npm run lint:exposure
npm --prefix frontend run qa:tools-locales
git diff --check
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript if time allows**

```bash
cd frontend && ./node_modules/.bin/tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Manual acceptance checklist**

Verify:

- A user can upload or select a video, estimate price, run background removal, preview, download, and save result.
- Failed provider calls refund wallet and mark job failed.
- Realtime token endpoint requires auth and never exposes `FAL_KEY`.
- Realtime session is prepaid and time-limited.
- New jobs appear only under background removal recent rail, not generic video/image rails.
- Saved outputs are reusable from the media library.
- Public landing pages load in en/fr/es.
- Marketing copy does not mention fal.
- Feature flag off hides both API and UI.

- [ ] **Step 5: Commit final fixes**

If verification required fixes:

```bash
git add <changed-files>
git commit -m "fix: complete background removal verification"
```

## Execution Notes For `superpowers:executing-plans`

- Review this plan before starting. If the fal realtime webcam payload requires an SDK-specific media stream call not covered by the public schema, stop at Task 5/6 and ask for a small spike instead of guessing.
- Keep commits at the end of each task.
- Do not start implementation on `main`.
- Use `superpowers:finishing-a-development-branch` after Task 9.
