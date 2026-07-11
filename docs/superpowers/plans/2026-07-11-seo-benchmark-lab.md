# MaxVideoAI Benchmark Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a polished localized Benchmark Lab that exposes MaxVideoAI editorial scores, sourced video-model specifications, and eligible rolling latency metrics without publishing production volumes, user counts, failure counts, or success rates.

**Architecture:** Keep the public route as a thin Server Component. Version methodology in `data/benchmarks/`, read benchmark files through one cached server boundary, calculate latency through a separate read-only server module, and shape route data in route-local pure builders. Render the page with focused Server Components and reuse one shared methodology link across model and comparison score surfaces.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, PostgreSQL through `pg`, Tailwind design tokens, `next-intl` navigation, Node test runner through `tsx`.

## Global Constraints

- Work only in `/Users/adrienmillot/Desktop/MaxVideoAi V2/.worktrees/seo-benchmark-lab` on `codex/seo-benchmark-lab`.
- Preserve every current score value, model URL, comparison URL, price, refund flow, generation flow, and accessible legacy model.
- Public operational output contains only model identity, rolling-window date, median latency, and P90 latency.
- Job count, user count, failure count, success rate, and refund rate remain internal and never enter the public result type or rendered markup.
- Public refund copy is exactly equivalent to `Failed paid generations are automatically refunded.` without an admin caveat or automation percentage.
- Latency becomes public only after at least 30 completed jobs and 5 distinct non-admin users in the rolling 30-day window.
- The numeric eligibility thresholds stay server-only and are not rendered in the page methodology, empty state, markup, or copy.
- Exclude every ID in `ADMIN_EXCLUDED_USER_IDS` before aggregation.
- Use `app_jobs.updated_at - app_jobs.created_at` for end-to-end latency; do not use the partial `app_generate_metrics` completed stream.
- Use American English, French, and Latin American Spanish (`es-419`) surrounding copy.
- Keep the eight canonical benchmark prompts in English in every locale so future runs use identical instructions.
- Do not run paid benchmark generations in this lot.
- Do not add `Dataset` schema, per-model benchmark routes, new client-side state, or a public API endpoint.
- Use a six-hour page revalidation interval (`21600` seconds).
- Use existing theme tokens (`bg-bg`, `bg-surface`, `border-hairline`, `text-text-primary`, `text-text-secondary`, `text-brand`) and preserve dark mode.
- Keep every new route file focused; `page.tsx` orchestrates and route-local components own JSX sections.
- Follow TDD: failing focused test, minimal implementation, passing focused test, then commit.

---

## File Structure

### New data and server files

- `data/benchmarks/benchmark-methodology.v1.json`: versioned criteria, formula, canonical prompt pack, run requirements, limitations, and changelog.
- `frontend/server/benchmark-lab-data.ts`: cached read-only loader for scores, specifications, and methodology.
- `frontend/server/benchmark-lab-metrics.ts`: read-only eligible latency aggregation and safe public result mapping.

### New Benchmark Lab route

- `frontend/app/(localized)/[locale]/(marketing)/benchmarks/page.tsx`: metadata, parallel data loading, schema, and view orchestration.
- `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-copy.ts`: complete EN/FR/es-419 page copy and display labels.
- `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-page-data.ts`: pure score/spec page-row builder and date/value formatting.
- `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-schema.ts`: `WebPage` and `BreadcrumbList` builders.
- `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkLabView.tsx`: visual orchestration only.
- `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkScoreTable.tsx`: full editorial score matrix.
- `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkSpecsTable.tsx`: sourced capability matrix.
- `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkLatencySection.tsx`: eligible median/P90 cards with no public sample counts.
- `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkMethodologySection.tsx`: formula, criteria, prompt pack, limits, and changelog.
- `frontend/next-sitemap.config.js`: add the hub to the localized marketing sitemap roster.

### Shared integration

- `frontend/components/marketing/BenchmarkMethodologyLink.tsx`: localized reusable link.
- Modify `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareScorecardSection.tsx`.
- Modify `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareDetailContent.tsx`.
- Modify `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx`.
- Modify `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx`.
- Modify `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelSpecsSection.tsx`.
- Modify `frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx`.
- Modify `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogRecommendedSection.tsx`.
- Modify `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/page.tsx`.

### Tests

- `tests/benchmark-lab-data.test.ts`.
- `tests/benchmark-lab-metrics.test.ts`.
- `tests/benchmark-lab-route.test.ts`.
- Update `tests/compare-page-architecture.test.ts`.
- Update `tests/model-page-layout-architecture.test.ts`.
- Update `tests/models-catalog-architecture.test.ts`.

---

### Task 1: Version the benchmark methodology and static data boundary

**Files:**
- Create: `data/benchmarks/benchmark-methodology.v1.json`
- Create: `frontend/server/benchmark-lab-data.ts`
- Create: `tests/benchmark-lab-data.test.ts`

**Interfaces:**
- Produces: `loadBenchmarkLabStaticData(): Promise<BenchmarkLabStaticData>`
- Produces: `loadBenchmarkScoreSlugs(): Promise<Set<string>>`
- Produces: `computeBenchmarkOverall(score: BenchmarkScore): number | null`
- Consumes: existing `engine-scores.v1.json` and `engine-key-specs.v1.json`

- [ ] **Step 1: Write the failing methodology contract test**

Create `tests/benchmark-lab-data.test.ts` with these exact assertions:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import methodology from '../data/benchmarks/benchmark-methodology.v1.json' with { type: 'json' };
import scores from '../data/benchmarks/engine-scores.v1.json' with { type: 'json' };
import {
  computeBenchmarkOverall,
  loadBenchmarkLabStaticData,
  loadBenchmarkScoreSlugs,
} from '../frontend/server/benchmark-lab-data';

test('benchmark methodology is versioned and preserves the current overall formula', () => {
  assert.equal(methodology.version, '1.0.0');
  assert.equal(methodology.effectiveDate, '2026-07-11');
  assert.deepEqual(methodology.overallFormula.fields, ['fidelity', 'motion', 'consistency']);
  assert.equal(methodology.overallFormula.method, 'arithmetic_mean');
  assert.equal(methodology.overallFormula.roundToDecimals, 1);
  assert.equal(methodology.criteria.length, 11);
  assert.equal(new Set(methodology.criteria.map((criterion) => criterion.id)).size, 11);
  assert.equal(methodology.promptPack.length, 8);
  assert.ok(methodology.promptPack.every((entry) => entry.language === 'en-US'));
  assert.ok(methodology.promptPack.every((entry) => entry.prompt.length >= 120));
  assert.deepEqual(methodology.operationalLatency, {
    windowDays: 30,
    minimumCompletedJobs: 30,
    minimumDistinctUsers: 5,
    medianPercentile: 0.5,
    slowPercentile: 0.9,
  });
});

test('static loader returns the current score and specification sources unchanged', async () => {
  const data = await loadBenchmarkLabStaticData();
  assert.equal(data.scores.length, scores.scores.length);
  assert.ok(data.specs.length >= data.scores.length);
  assert.equal(data.methodology.version, '1.0.0');
  assert.equal(data.scores.find((row) => row.modelSlug === 'sora-2')?.last_updated, '2026-01-27');
});

test('overall score stays aligned with current model and compare hubs', () => {
  assert.equal(computeBenchmarkOverall({ fidelity: 8.4, motion: 7.9, consistency: 7.4 }), 7.9);
  assert.equal(computeBenchmarkOverall({ fidelity: 8.4, motion: null, consistency: undefined }), 8.4);
  assert.equal(computeBenchmarkOverall({}), null);
});

test('score slug lookup exposes the exact current editorial roster', async () => {
  const slugs = await loadBenchmarkScoreSlugs();
  assert.equal(slugs.size, scores.scores.length);
  assert.ok(slugs.has('kling-3-pro'));
  assert.ok(slugs.has('dreamina-seedance-2-0-mini'));
});
```

- [ ] **Step 2: Run the test and verify the missing-file failure**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/benchmark-lab-data.test.ts
```

Expected: FAIL because `benchmark-methodology.v1.json` and `frontend/server/benchmark-lab-data.ts` do not exist.

- [ ] **Step 3: Add the exact methodology dataset**

Create `data/benchmarks/benchmark-methodology.v1.json` with this shape and content:

```json
{
  "version": "1.0.0",
  "effectiveDate": "2026-07-11",
  "scoreScale": {
    "minimum": 0,
    "maximum": 10,
    "anchors": [
      { "score": 2, "meaning": "Major visible failures prevent practical use." },
      { "score": 5, "meaning": "Usable in selected shots with clear limitations." },
      { "score": 8, "meaning": "Strong production-ready behavior for the tested criterion." },
      { "score": 10, "meaning": "Exceptional behavior with no material issue in the evaluated outputs." }
    ]
  },
  "overallFormula": {
    "method": "arithmetic_mean",
    "fields": ["fidelity", "motion", "consistency"],
    "roundToDecimals": 1
  },
  "criteria": [
    { "id": "fidelity", "label": "Prompt adherence", "definition": "How closely the output follows requested subjects, actions, composition, and constraints.", "includedInOverall": true },
    { "id": "visualQuality", "label": "Visual quality", "definition": "Perceived detail, realism, lighting, material rendering, and absence of visible artifacts.", "includedInOverall": false },
    { "id": "motion", "label": "Motion realism", "definition": "Smoothness, physical plausibility, camera movement, and temporal behavior of moving subjects.", "includedInOverall": true },
    { "id": "consistency", "label": "Temporal consistency", "definition": "Identity, object, background, and style stability across the generated clip.", "includedInOverall": true },
    { "id": "anatomy", "label": "Human fidelity", "definition": "Faces, hands, limbs, body proportions, contact, and human-object interactions.", "includedInOverall": false },
    { "id": "textRendering", "label": "Text legibility", "definition": "Accuracy and stability of requested words, labels, interface elements, and signage.", "includedInOverall": false },
    { "id": "lipsyncQuality", "label": "Audio and lip sync", "definition": "Alignment between visible speech, dialogue timing, and generated audio when the model supports audio.", "includedInOverall": false },
    { "id": "sequencingQuality", "label": "Multi-shot sequencing", "definition": "Continuity, narrative order, and identity preservation across explicit shot changes.", "includedInOverall": false },
    { "id": "controllability", "label": "Controllability", "definition": "Reliability of camera, reference, framing, and other supported production controls.", "includedInOverall": false },
    { "id": "speedStability", "label": "Speed and stability", "definition": "Editorial assessment of delivery consistency; live median and P90 latency are published separately.", "includedInOverall": false },
    { "id": "pricing", "label": "Value score", "definition": "Relative production value at the current MaxVideoAI price position; exact live pricing remains on pricing and generation surfaces.", "includedInOverall": false }
  ],
  "promptPack": [
    {
      "id": "hands-object",
      "title": "Hands and object interaction",
      "language": "en-US",
      "appliesTo": "all-video-models",
      "prompt": "Documentary-style medium close-up of a ceramic artist at a sunlit studio table. The artist picks up a small blue cup with the left hand, rotates it slowly with both hands, checks the rim, and places it beside a wooden carving tool. Keep five natural fingers on each hand, believable contact, stable cup geometry, and one continuous camera take."
    },
    {
      "id": "two-character-continuity",
      "title": "Two-character identity continuity",
      "language": "en-US",
      "appliesTo": "all-video-models",
      "prompt": "Two distinct friends meet beside a train-station clock at golden hour. One wears a red denim jacket and round glasses; the other wears a navy wool coat and carries a folded paper map. They exchange the map, point toward platform seven, then walk together toward the camera. Preserve each face, outfit, body position, and the map throughout one continuous shot."
    },
    {
      "id": "fast-motion-camera",
      "title": "Fast motion and camera tracking",
      "language": "en-US",
      "appliesTo": "all-video-models",
      "prompt": "Low-angle tracking shot beside a cyclist moving quickly through a wet city street just after rain. The camera accelerates smoothly, passes a reflective bus shelter, then arcs around the cyclist without changing the bicycle frame, wheel shape, clothing, or direction of travel. Preserve realistic tire contact, water spray, motion blur, reflections, and stable urban geometry."
    },
    {
      "id": "product-text",
      "title": "Product and text legibility",
      "language": "en-US",
      "appliesTo": "all-video-models",
      "prompt": "Premium studio product shot of a matte black coffee can rotating slowly on a dark stone pedestal. The front label must read exactly “MAX NORTH” in large white letters with “COLD BREW” directly below in smaller gold letters. Use a controlled rim light and a gentle push-in. Keep the can cylindrical, the typography readable, and every letter unchanged for the full shot."
    },
    {
      "id": "cinematic-materials",
      "title": "Cinematic lighting and materials",
      "language": "en-US",
      "appliesTo": "all-video-models",
      "prompt": "Cinematic night-market scene in light rain, photographed at eye level with a slow forward dolly. Warm paper lanterns reflect on wet pavement while steam rises from a stainless-steel food cart. A vendor in a green apron serves a ceramic bowl to a customer. Preserve realistic skin, fabric, metal, ceramic, steam, rain, reflections, and consistent lighting without flicker."
    },
    {
      "id": "camera-control",
      "title": "Constrained camera control",
      "language": "en-US",
      "appliesTo": "all-video-models",
      "prompt": "Perfectly centered architectural shot of a modern concrete gallery with a single red chair in the middle. Begin with a locked symmetrical wide frame for two seconds, then perform one slow straight dolly forward. Do not pan, tilt, roll, orbit, zoom, add objects, move the chair, or change the lighting. Keep vertical lines straight and the composition symmetrical."
    },
    {
      "id": "dialogue-lipsync",
      "title": "Dialogue and lip synchronization",
      "language": "en-US",
      "appliesTo": "audio-capable-models",
      "prompt": "Medium close-up of a presenter in a quiet daylight studio looking directly into the camera. The presenter says exactly: “Every frame should feel intentional, clear, and ready to share.” Use a natural conversational pace, clean studio sound, stable facial identity, realistic blinking, and precise lip movement synchronized to every spoken word. No subtitles and no background music."
    },
    {
      "id": "three-shot-sequence",
      "title": "Three-shot sequencing",
      "language": "en-US",
      "appliesTo": "multi-shot-capable-models",
      "prompt": "Create a coherent three-shot sequence featuring the same woman in a yellow raincoat and the same silver compact camera: shot one, a wide view as she enters a foggy pine forest; shot two, a close-up as she raises the camera and takes one photograph; shot three, an over-the-shoulder view of the captured deer on the camera screen. Preserve her identity, clothing, camera, weather, direction, and color grade across all shots."
    }
  ],
  "requiredRunMetadata": [
    "evaluationDate",
    "modelVersion",
    "evaluator",
    "reviewer",
    "promptPackVersion",
    "sampleSize",
    "resolution",
    "aspectRatio",
    "duration",
    "mode",
    "controls",
    "retryCount",
    "failureCount"
  ],
  "operationalLatency": {
    "windowDays": 30,
    "minimumCompletedJobs": 30,
    "minimumDistinctUsers": 5,
    "medianPercentile": 0.5,
    "slowPercentile": 0.9
  },
  "limitations": [
    "Generative outputs vary between runs.",
    "Not every model supports every criterion or prompt type.",
    "Provider capacity and queues change over time.",
    "Production traffic is not a controlled experiment.",
    "MaxVideoAI sells access to the compared models and discloses that commercial interest."
  ],
  "changelog": [
    {
      "date": "2026-07-11",
      "version": "1.0.0",
      "summary": "Published the initial score definitions, current overall formula, canonical prompt pack, and rolling latency rules."
    }
  ]
}
```

- [ ] **Step 4: Implement the cached static loader and shared overall function**

Create `frontend/server/benchmark-lab-data.ts` with these public types and functions:

```ts
import path from 'node:path';
import { promises as fs } from 'node:fs';

export type BenchmarkScore = {
  modelSlug?: string;
  engineId?: string;
  fidelity?: number | null;
  visualQuality?: number | null;
  motion?: number | null;
  consistency?: number | null;
  anatomy?: number | null;
  textRendering?: number | null;
  lipsyncQuality?: number | null;
  sequencingQuality?: number | null;
  controllability?: number | null;
  speedStability?: number | null;
  pricing?: number | null;
  last_updated?: string | null;
};

export type BenchmarkSpec = {
  modelSlug?: string;
  engineId?: string;
  sources?: string[];
  keySpecs?: Record<string, unknown>;
};

export type BenchmarkMethodology = {
  version: string;
  effectiveDate: string;
  scoreScale: {
    minimum: number;
    maximum: number;
    anchors: Array<{ score: number; meaning: string }>;
  };
  overallFormula: {
    method: 'arithmetic_mean';
    fields: Array<'fidelity' | 'motion' | 'consistency'>;
    roundToDecimals: number;
  };
  criteria: Array<{
    id: keyof BenchmarkScore;
    label: string;
    definition: string;
    includedInOverall: boolean;
  }>;
  promptPack: Array<{
    id: string;
    title: string;
    language: 'en-US';
    appliesTo: string;
    prompt: string;
  }>;
  requiredRunMetadata: string[];
  operationalLatency: {
    windowDays: 30;
    minimumCompletedJobs: 30;
    minimumDistinctUsers: 5;
    medianPercentile: 0.5;
    slowPercentile: 0.9;
  };
  limitations: string[];
  changelog: Array<{ date: string; version: string; summary: string }>;
};

export type BenchmarkLabStaticData = {
  scores: BenchmarkScore[];
  specs: BenchmarkSpec[];
  methodology: BenchmarkMethodology;
};

let staticDataPromise: Promise<BenchmarkLabStaticData> | null = null;

function benchmarkPath(filename: string) {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', filename),
    path.join(process.cwd(), '..', 'data', 'benchmarks', filename),
  ];
  return candidates;
}

async function readFirstJson<T>(filename: string): Promise<T> {
  let lastError: unknown = null;
  for (const candidate of benchmarkPath(filename)) {
    try {
      return JSON.parse(await fs.readFile(candidate, 'utf8')) as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Unable to read ${filename}`);
}

export function computeBenchmarkOverall(score: BenchmarkScore): number | null {
  const values = [score.fidelity, score.motion, score.consistency].filter(
    (value): value is number => typeof value === 'number'
  );
  if (!values.length) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(average * 10) / 10;
}

export function loadBenchmarkLabStaticData(): Promise<BenchmarkLabStaticData> {
  if (!staticDataPromise) {
    staticDataPromise = Promise.all([
      readFirstJson<{ scores?: BenchmarkScore[] }>('engine-scores.v1.json'),
      readFirstJson<{ specs?: BenchmarkSpec[] }>('engine-key-specs.v1.json'),
      readFirstJson<BenchmarkMethodology>('benchmark-methodology.v1.json'),
    ]).then(([scoresFile, specsFile, methodology]) => ({
      scores: scoresFile.scores ?? [],
      specs: specsFile.specs ?? [],
      methodology,
    }));
  }
  return staticDataPromise;
}

export async function loadBenchmarkScoreSlugs(): Promise<Set<string>> {
  const data = await loadBenchmarkLabStaticData();
  return new Set(
    data.scores
      .map((row) => row.modelSlug ?? row.engineId ?? '')
      .map((slug) => slug.trim())
      .filter(Boolean)
  );
}
```

- [ ] **Step 5: Run the focused test**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/benchmark-lab-data.test.ts
```

Expected: 4 tests pass, 0 fail.

- [ ] **Step 6: Commit the methodology boundary**

```bash
git add data/benchmarks/benchmark-methodology.v1.json frontend/server/benchmark-lab-data.ts tests/benchmark-lab-data.test.ts
git commit -m "feat: define benchmark lab methodology"
```

---

### Task 2: Add the read-only eligible latency aggregate

**Files:**
- Create: `frontend/server/benchmark-lab-metrics.ts`
- Create: `tests/benchmark-lab-metrics.test.ts`

**Interfaces:**
- Consumes: `ADMIN_EXCLUDED_USER_IDS`, `listFalEngines()`, `getEngineAliases()`
- Produces: `fetchPublicBenchmarkLatency(): Promise<PublicBenchmarkLatencySnapshot>`
- Produces: `mapBenchmarkLatencyRows(rows, engines): PublicBenchmarkLatency[]`

- [ ] **Step 1: Write the failing aggregate contract test**

Create `tests/benchmark-lab-metrics.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import type { FalEngineEntry } from '../frontend/src/config/falEngines';
import {
  fetchPublicBenchmarkLatency,
  mapBenchmarkLatencyRows,
  type BenchmarkLatencyAggregateRow,
  type BenchmarkQuery,
} from '../frontend/server/benchmark-lab-metrics';

const engines = [
  {
    id: 'kling-3-pro',
    modelSlug: 'kling-3-pro',
    engine: { id: 'kling-3-pro', modes: ['t2v'] },
    modes: [],
    surfaces: { modelPage: { indexable: true, includeInSitemap: true } },
  },
] as unknown as FalEngineEntry[];

test('latency mapper emits only public-safe fields for mapped models', () => {
  const rows: BenchmarkLatencyAggregateRow[] = [
    {
      engine_id: 'kling-3-pro',
      completed_count: 104,
      distinct_users: 28,
      median_duration_ms: 230800,
      p90_duration_ms: 451600,
      as_of: '2026-07-11T14:00:00.000Z',
    },
    {
      engine_id: 'unknown-engine',
      completed_count: 80,
      distinct_users: 20,
      median_duration_ms: 100000,
      p90_duration_ms: 200000,
      as_of: '2026-07-11T14:00:00.000Z',
    },
  ];

  const mapped = mapBenchmarkLatencyRows(rows, engines);
  assert.deepEqual(mapped, [
    {
      engineId: 'kling-3-pro',
      modelSlug: 'kling-3-pro',
      medianDurationMs: 230800,
      p90DurationMs: 451600,
      asOf: '2026-07-11T14:00:00.000Z',
    },
  ]);
  assert.equal('completedCount' in mapped[0]!, false);
  assert.equal('distinctUsers' in mapped[0]!, false);
  assert.equal('successRate' in mapped[0]!, false);
});

test('latency query applies internal thresholds and admin exclusions', async () => {
  let capturedSql = '';
  let capturedParams: readonly unknown[] = [];
  const queryFn: BenchmarkQuery = async <T>(sql: string, params?: readonly unknown[]) => {
    capturedSql = sql;
    capturedParams = params ?? [];
    return [] as T[];
  };

  const snapshot = await fetchPublicBenchmarkLatency({
    queryFn,
    databaseConfigured: true,
    engines,
  });

  assert.equal(snapshot.status, 'available');
  assert.deepEqual(snapshot.rows, []);
  assert.match(capturedSql, /COUNT\(\*\) >= \$4/);
  assert.match(capturedSql, /COUNT\(DISTINCT user_id\) >= \$5/);
  assert.match(capturedSql, /user_id <> ALL\(\$1::text\[\]\)/);
  assert.equal(capturedParams[1], 30);
  assert.equal(capturedParams[3], 30);
  assert.equal(capturedParams[4], 5);
});

test('missing database returns unavailable rather than zero metrics', async () => {
  const snapshot = await fetchPublicBenchmarkLatency({
    databaseConfigured: false,
    engines,
  });
  assert.deepEqual(snapshot, { status: 'unavailable', windowDays: 30, asOf: null, rows: [] });
});
```

- [ ] **Step 2: Run the test and verify failure**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/benchmark-lab-metrics.test.ts
```

Expected: FAIL because `benchmark-lab-metrics.ts` does not exist.

- [ ] **Step 3: Implement the read-only aggregate**

Create `frontend/server/benchmark-lab-metrics.ts` with this contract and query:

```ts
import { getEngineAliases, listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ADMIN_EXCLUDED_USER_IDS } from '@/lib/admin/exclusions';
import { supportsVideoGeneration } from '@/lib/models/catalog';

const WINDOW_DAYS = 30 as const;
const MIN_COMPLETED_JOBS = 30;
const MIN_DISTINCT_USERS = 5;
const COMPLETED_STATUSES = ['completed', 'success', 'succeeded', 'finished'];

export type BenchmarkLatencyAggregateRow = {
  engine_id: string;
  completed_count: number | string | null;
  distinct_users: number | string | null;
  median_duration_ms: number | string | null;
  p90_duration_ms: number | string | null;
  as_of: string | Date | null;
};

export type PublicBenchmarkLatency = {
  engineId: string;
  modelSlug: string;
  medianDurationMs: number;
  p90DurationMs: number;
  asOf: string;
};

export type PublicBenchmarkLatencySnapshot = {
  status: 'available' | 'unavailable';
  windowDays: 30;
  asOf: string | null;
  rows: PublicBenchmarkLatency[];
};

export type BenchmarkQuery = <TRecord = unknown>(
  text: string,
  params?: readonly unknown[]
) => Promise<TRecord[]>;

function toNumber(value: number | string | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildModelSlugByAlias(engines: FalEngineEntry[]) {
  const map = new Map<string, string>();
  engines.forEach((engine) => {
    [engine.id, engine.modelSlug, engine.engine.id, ...getEngineAliases(engine)].forEach((alias) => {
      if (alias?.trim()) map.set(alias.trim().toLowerCase(), engine.modelSlug);
    });
  });
  return map;
}

export function mapBenchmarkLatencyRows(
  rows: BenchmarkLatencyAggregateRow[],
  engines: FalEngineEntry[] = listFalEngines()
): PublicBenchmarkLatency[] {
  const modelSlugByAlias = buildModelSlugByAlias(
    engines.filter((engine) => supportsVideoGeneration(engine))
  );
  return rows.flatMap((row) => {
    const modelSlug = modelSlugByAlias.get(row.engine_id.trim().toLowerCase());
    const medianDurationMs = toNumber(row.median_duration_ms);
    const p90DurationMs = toNumber(row.p90_duration_ms);
    const asOf = row.as_of instanceof Date ? row.as_of.toISOString() : row.as_of;
    if (!modelSlug || medianDurationMs == null || p90DurationMs == null || !asOf) return [];
    return [{ engineId: row.engine_id, modelSlug, medianDurationMs, p90DurationMs, asOf }];
  });
}

export async function fetchPublicBenchmarkLatency(options?: {
  queryFn?: BenchmarkQuery;
  databaseConfigured?: boolean;
  engines?: FalEngineEntry[];
}): Promise<PublicBenchmarkLatencySnapshot> {
  const configured = options?.databaseConfigured ?? isDatabaseConfigured();
  if (!configured) return { status: 'unavailable', windowDays: WINDOW_DAYS, asOf: null, rows: [] };

  const queryFn = options?.queryFn ?? query;
  try {
    const rawRows = await queryFn<BenchmarkLatencyAggregateRow>(
      `
        WITH completed_jobs AS (
          SELECT
            COALESCE(NULLIF(engine_id, ''), 'unknown') AS engine_id,
            user_id,
            updated_at,
            EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000 AS duration_ms
          FROM app_jobs
          WHERE created_at >= NOW() - make_interval(days => $2)
            AND user_id IS NOT NULL
            AND user_id <> ALL($1::text[])
            AND LOWER(COALESCE(status, '')) = ANY($3::text[])
            AND updated_at IS NOT NULL
            AND updated_at > created_at
        )
        SELECT
          engine_id,
          COUNT(*)::bigint AS completed_count,
          COUNT(DISTINCT user_id)::bigint AS distinct_users,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS median_duration_ms,
          PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY duration_ms) AS p90_duration_ms,
          MAX(updated_at) AS as_of
        FROM completed_jobs
        GROUP BY engine_id
        HAVING COUNT(*) >= $4
           AND COUNT(DISTINCT user_id) >= $5
        ORDER BY median_duration_ms ASC
      `,
      [ADMIN_EXCLUDED_USER_IDS, WINDOW_DAYS, COMPLETED_STATUSES, MIN_COMPLETED_JOBS, MIN_DISTINCT_USERS]
    );
    const rows = mapBenchmarkLatencyRows(rawRows, options?.engines ?? listFalEngines());
    const asOf = rows.reduce<string | null>((latest, row) => (!latest || row.asOf > latest ? row.asOf : latest), null);
    return { status: 'available', windowDays: WINDOW_DAYS, asOf, rows };
  } catch (error) {
    console.warn('[benchmark-lab] latency snapshot unavailable', error);
    return { status: 'unavailable', windowDays: WINDOW_DAYS, asOf: null, rows: [] };
  }
}
```

- [ ] **Step 4: Run the focused test**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/benchmark-lab-metrics.test.ts
```

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Verify the real aggregate without exposing identifiers**

Run from `frontend/` with the root environment file:

```bash
./node_modules/.bin/tsx --env-file='/Users/adrienmillot/Desktop/MaxVideoAi V2/frontend/.env.local' --tsconfig tsconfig.json -e "import { fetchPublicBenchmarkLatency } from './server/benchmark-lab-metrics.ts'; void (async () => { const snapshot = await fetchPublicBenchmarkLatency(); console.log(JSON.stringify(snapshot, null, 2)); })();"
```

Expected: `status` is `available`; every row contains only `engineId`, `modelSlug`, `medianDurationMs`, `p90DurationMs`, and `asOf`; no row contains counts or rates.

- [ ] **Step 6: Commit the latency boundary**

```bash
git add frontend/server/benchmark-lab-metrics.ts tests/benchmark-lab-metrics.test.ts
git commit -m "feat: add public benchmark latency snapshot"
```

---

### Task 3: Build the localized route foundation and page data

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/benchmarks/page.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-copy.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-page-data.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-schema.ts`
- Modify: `frontend/next-sitemap.config.js`
- Create: `tests/benchmark-lab-route.test.ts`

**Interfaces:**
- Consumes: `loadBenchmarkLabStaticData()`, `fetchPublicBenchmarkLatency()`
- Produces: `getBenchmarkCopy(locale): BenchmarkCopy`
- Produces: `buildBenchmarkPageData(staticData, latency): BenchmarkPageData`
- Produces: `buildBenchmarkWebPageJsonLd()` and `buildBenchmarkBreadcrumbJsonLd()`

- [ ] **Step 1: Write the failing route architecture and copy test**

Create `tests/benchmark-lab-route.test.ts` with route, copy, privacy, and schema checks:

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildBenchmarkPageData } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-page-data';
import { getBenchmarkCopy } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-copy';
import { loadBenchmarkLabStaticData } from '../frontend/server/benchmark-lab-data';

const routeRoot = 'frontend/app/(localized)/[locale]/(marketing)/benchmarks';
const pagePath = path.join(routeRoot, 'page.tsx');

test('benchmark lab route stays a thin localized server orchestrator', () => {
  assert.ok(existsSync(pagePath));
  const source = readFileSync(pagePath, 'utf8');
  assert.match(source, /export const revalidate = 21600/);
  assert.match(source, /englishPath: '\/benchmarks'/);
  assert.match(source, /loadBenchmarkLabStaticData/);
  assert.match(source, /fetchPublicBenchmarkLatency/);
  assert.match(source, /BenchmarkLabView/);
  assert.doesNotMatch(source, /FROM app_jobs|PERCENTILE_CONT|scores\.map|specs\.map/);
  assert.ok(source.split('\n').length <= 120);
});

test('benchmark copy is complete in American English, French, and Latin American Spanish', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getBenchmarkCopy(locale);
    assert.ok(copy.meta.title.length >= 30);
    assert.ok(copy.hero.title.length >= 20);
    assert.equal(copy.refundNote.length > 0, true);
    assert.equal(copy.scoreLabels.length, 11);
    assert.equal(Object.keys(copy.methodology.criteria).length, 11);
    assert.equal(copy.methodology.methodNotes.length, 5);
  }
  assert.equal(getBenchmarkCopy('en').refundNote, 'Failed paid generations are automatically refunded.');
  assert.match(getBenchmarkCopy('es').hero.intro, /modelos de video/i);
});

test('page builder keeps production volumes and rates out of public data', () => {
  const pageData = buildBenchmarkPageData(
    {
      scores: [{ modelSlug: 'kling-3-pro', fidelity: 8.6, motion: 8.4, consistency: 8.0 }],
      specs: [{ modelSlug: 'kling-3-pro', sources: ['https://fal.ai/models/kling'], keySpecs: { maxDuration: '15s', maxResolution: '1080p' } }],
      methodology: {
        version: '1.0.0', effectiveDate: '2026-07-11', scoreScale: { minimum: 0, maximum: 10, anchors: [] },
        overallFormula: { method: 'arithmetic_mean', fields: ['fidelity', 'motion', 'consistency'], roundToDecimals: 1 },
        criteria: [], promptPack: [], requiredRunMetadata: [],
        operationalLatency: { windowDays: 30, minimumCompletedJobs: 30, minimumDistinctUsers: 5, medianPercentile: 0.5, slowPercentile: 0.9 },
        limitations: [], changelog: [],
      },
    },
    { status: 'available', windowDays: 30, asOf: '2026-07-11T14:00:00.000Z', rows: [{ engineId: 'kling-3-pro', modelSlug: 'kling-3-pro', medianDurationMs: 230800, p90DurationMs: 451600, asOf: '2026-07-11T14:00:00.000Z' }] }
  );
  assert.equal(pageData.scores[0]?.overall, 8.3);
  assert.equal(pageData.latency.rows[0]?.medianDurationMs, 230800);
  assert.equal(JSON.stringify(pageData).includes('successRate'), false);
  assert.equal(JSON.stringify(pageData).includes('completedJobs'), false);
  assert.equal(JSON.stringify(pageData).includes('distinctUsers'), false);
  assert.equal(JSON.stringify(pageData).includes('minimumCompletedJobs'), false);
  assert.equal(JSON.stringify(pageData).includes('minimumDistinctUsers'), false);
  assert.equal(JSON.stringify(pageData).includes('sampleSize'), false);
});

test('page builder preserves the complete editorial roster, including legacy video models', async () => {
  const staticData = await loadBenchmarkLabStaticData();
  const pageData = buildBenchmarkPageData(staticData, { status: 'unavailable', windowDays: 30, asOf: null, rows: [] });
  assert.equal(pageData.scores.length, staticData.scores.length);
  assert.ok(pageData.scores.some((row) => row.modelSlug === 'ltx-2'));
});

test('localized sitemap generation includes the benchmark hub', () => {
  const sitemapSource = readFileSync('frontend/next-sitemap.config.js', 'utf8');
  assert.match(sitemapSource, /MARKETING_CORE_PATHS[\s\S]*['"]\/benchmarks['"]/);
});
```

- [ ] **Step 2: Run the test and verify missing-module failures**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/benchmark-lab-route.test.ts
```

Expected: FAIL because the route-local modules do not exist.

- [ ] **Step 3: Implement the exact localized copy contract**

In `_lib/benchmark-copy.ts`, define `BenchmarkCopy` and all three locale entries. Use these exact public headlines and messages:

```ts
import type { AppLocale } from '@/i18n/locales';

export type BenchmarkCopy = {
  meta: { title: string; description: string };
  hero: { eyebrow: string; title: string; intro: string; proof: string };
  nav: { scores: string; specs: string; speed: string; method: string };
  evidence: Array<{ title: string; body: string }>;
  scores: { title: string; intro: string; updated: string; source: string };
  specs: {
    title: string;
    intro: string;
    source: string;
    modes: string;
    audio: string;
    references: string;
    modeLabels: Record<'textToVideo' | 'imageToVideo' | 'videoToVideo', string>;
  };
  latency: { title: string; intro: string; median: string; p90: string; window: string; unavailable: string; more: string };
  methodology: {
    title: string;
    intro: string;
    formula: string;
    prompts: string;
    canonicalPrompt: string;
    limitations: string;
    changelog: string;
    criteria: Record<string, { label: string; definition: string }>;
    methodNotes: string[];
    initialRelease: string;
  };
  refundNote: string;
  cta: { title: string; body: string; models: string; compare: string; pricing: string; generate: string };
  scoreLabels: Array<{ id: string; label: string }>;
};

const SCORE_LABELS = {
  en: ['Prompt', 'Visual', 'Motion', 'Consistency', 'Human', 'Text', 'Audio', 'Sequencing', 'Control', 'Stability', 'Value'],
  fr: ['Prompt', 'Visuel', 'Mouvement', 'Cohérence', 'Humain', 'Texte', 'Audio', 'Séquences', 'Contrôle', 'Stabilité', 'Valeur'],
  es: ['Prompt', 'Visual', 'Movimiento', 'Consistencia', 'Personas', 'Texto', 'Audio', 'Secuencias', 'Control', 'Estabilidad', 'Valor'],
} as const;

const SCORE_IDS = ['fidelity', 'visualQuality', 'motion', 'consistency', 'anatomy', 'textRendering', 'lipsyncQuality', 'sequencingQuality', 'controllability', 'speedStability', 'pricing'];

const COPY: Record<AppLocale, Omit<BenchmarkCopy, 'scoreLabels'>> = {
  en: {
    meta: { title: 'AI Video Model Benchmarks & Methodology', description: 'Compare MaxVideoAI editorial scores, sourced AI video model specifications, and observed median and P90 generation times.' },
    hero: { eyebrow: 'MaxVideoAI Research', title: 'AI video model benchmarks, explained', intro: 'Compare editorial quality scores, sourced model capabilities, and observed generation times in one clear research hub.', proof: 'Built from MaxVideoAI scorecards, current model specifications, and anonymized production latency.' },
    nav: { scores: 'Scorecards', specs: 'Specifications', speed: 'Observed speed', method: 'Methodology' },
    evidence: [
      { title: 'Editorial scores', body: 'A consistent 0–10 framework for quality, motion, control, and production fit.' },
      { title: 'Sourced specifications', body: 'Current capabilities checked against provider sources and the MaxVideoAI route.' },
      { title: 'Observed speed', body: 'Rolling 30-day median and P90 generation time for eligible models.' }
    ],
    scores: { title: 'Model scorecards', intro: 'Compare the current MaxVideoAI editorial view across eleven production criteria.', updated: 'Score updated', source: 'MaxVideoAI editorial score' },
    specs: { title: 'Verified model specifications', intro: 'Review the limits and workflows exposed through MaxVideoAI.', source: 'Source', modes: 'Input modes', audio: 'Audio', references: 'References', modeLabels: { textToVideo: 'Text → video', imageToVideo: 'Image → video', videoToVideo: 'Video → video' } },
    latency: { title: 'Observed generation times', intro: 'Median and P90 end-to-end generation time over a rolling 30-day window.', median: 'Median', p90: 'P90', window: 'Rolling 30 days', unavailable: 'The current latency snapshot is being refreshed.', more: 'Additional models appear as their rolling history matures.' },
    methodology: {
      title: 'How the scores work', intro: 'One scoring language, one overall formula, and one canonical prompt pack for future documented runs.', formula: 'Overall score formula', prompts: 'Canonical prompt pack', canonicalPrompt: 'Canonical prompt — English', limitations: 'Method notes', changelog: 'Methodology updates',
      criteria: {
        fidelity: { label: 'Prompt adherence', definition: 'How closely the output follows requested subjects, actions, composition, and constraints.' },
        visualQuality: { label: 'Visual quality', definition: 'Perceived detail, realism, lighting, material rendering, and absence of visible artifacts.' },
        motion: { label: 'Motion realism', definition: 'Smoothness, physical plausibility, camera movement, and temporal behavior of moving subjects.' },
        consistency: { label: 'Temporal consistency', definition: 'Identity, object, background, and style stability across the generated clip.' },
        anatomy: { label: 'Human fidelity', definition: 'Faces, hands, limbs, body proportions, contact, and human-object interactions.' },
        textRendering: { label: 'Text legibility', definition: 'Accuracy and stability of requested words, labels, interface elements, and signage.' },
        lipsyncQuality: { label: 'Audio and lip sync', definition: 'Alignment between visible speech, dialogue timing, and generated audio when supported.' },
        sequencingQuality: { label: 'Multi-shot sequencing', definition: 'Continuity, narrative order, and identity preservation across explicit shot changes.' },
        controllability: { label: 'Controllability', definition: 'Reliability of camera, reference, framing, and other supported production controls.' },
        speedStability: { label: 'Speed and stability', definition: 'Editorial assessment of delivery consistency; observed median and P90 latency are published separately.' },
        pricing: { label: 'Value score', definition: 'Relative production value at the current MaxVideoAI price position; live pricing remains on pricing and generation surfaces.' }
      },
      methodNotes: ['Generative outputs vary between runs.', 'Not every model supports every criterion or prompt type.', 'Provider capacity and queues change over time.', 'Observed production traffic is not a controlled experiment.', 'MaxVideoAI sells access to the compared models and discloses that commercial interest.'],
      initialRelease: 'Initial score definitions, overall formula, canonical prompt pack, and rolling latency rules.'
    },
    refundNote: 'Failed paid generations are automatically refunded.',
    cta: { title: 'Choose the right model for the next shot', body: 'Move from research to model specs, side-by-side comparisons, live pricing, or generation.', models: 'Browse video models', compare: 'Compare models', pricing: 'View pricing', generate: 'Generate video' }
  },
  fr: {
    meta: { title: 'Benchmarks des modèles vidéo IA et méthodologie', description: 'Comparez les scores éditoriaux MaxVideoAI, les spécifications sourcées et les temps de génération médians et P90 observés.' },
    hero: { eyebrow: 'Recherche MaxVideoAI', title: 'Les benchmarks des modèles vidéo IA, expliqués', intro: 'Comparez scores éditoriaux, capacités sourcées et temps de génération observés dans un même espace clair.', proof: 'Construit à partir des scorecards MaxVideoAI, des spécifications actuelles et de la latence de production anonymisée.' },
    nav: { scores: 'Scorecards', specs: 'Spécifications', speed: 'Vitesse observée', method: 'Méthodologie' },
    evidence: [
      { title: 'Scores éditoriaux', body: 'Un cadre cohérent sur 10 pour la qualité, le mouvement, le contrôle et le fit production.' },
      { title: 'Spécifications sourcées', body: 'Des capacités vérifiées selon les sources fournisseur et la route MaxVideoAI.' },
      { title: 'Vitesse observée', body: 'Médiane et P90 sur 30 jours glissants pour les modèles éligibles.' }
    ],
    scores: { title: 'Scorecards des modèles', intro: 'Comparez la lecture éditoriale MaxVideoAI actuelle sur onze critères de production.', updated: 'Score mis à jour', source: 'Score éditorial MaxVideoAI' },
    specs: { title: 'Spécifications vérifiées', intro: 'Consultez les limites et workflows réellement exposés dans MaxVideoAI.', source: 'Source', modes: 'Modes d’entrée', audio: 'Audio', references: 'Références', modeLabels: { textToVideo: 'Texte → vidéo', imageToVideo: 'Image → vidéo', videoToVideo: 'Vidéo → vidéo' } },
    latency: { title: 'Temps de génération observés', intro: 'Médiane et P90 du temps de génération de bout en bout sur 30 jours glissants.', median: 'Médiane', p90: 'P90', window: '30 jours glissants', unavailable: 'La mesure de latence actuelle est en cours d’actualisation.', more: 'D’autres modèles apparaissent à mesure que leur historique se consolide.' },
    methodology: {
      title: 'Comment fonctionnent les scores', intro: 'Un langage de notation commun, une formule globale et un pack de prompts canonique pour les futurs tests documentés.', formula: 'Formule du score global', prompts: 'Pack de prompts canonique', canonicalPrompt: 'Prompt canonique — anglais', limitations: 'Notes méthodologiques', changelog: 'Mises à jour de la méthode',
      criteria: {
        fidelity: { label: 'Respect du prompt', definition: 'Fidélité du résultat aux sujets, actions, cadrage et contraintes demandés.' },
        visualQuality: { label: 'Qualité visuelle', definition: 'Niveau de détail, réalisme, lumière, rendu des matières et absence d’artefacts visibles.' },
        motion: { label: 'Réalisme du mouvement', definition: 'Fluidité, plausibilité physique, mouvements de caméra et comportement temporel des sujets.' },
        consistency: { label: 'Cohérence temporelle', definition: 'Stabilité des identités, objets, décors et styles pendant toute la vidéo.' },
        anatomy: { label: 'Fidélité humaine', definition: 'Visages, mains, membres, proportions, contacts et interactions entre personnes et objets.' },
        textRendering: { label: 'Lisibilité du texte', definition: 'Exactitude et stabilité des mots, étiquettes, interfaces et panneaux demandés.' },
        lipsyncQuality: { label: 'Audio et synchronisation labiale', definition: 'Alignement entre la parole visible, le dialogue et l’audio généré lorsque cette fonction est disponible.' },
        sequencingQuality: { label: 'Enchaînement multi-plans', definition: 'Continuité, ordre narratif et préservation des identités entre plusieurs plans.' },
        controllability: { label: 'Contrôlabilité', definition: 'Fiabilité des contrôles de caméra, références, cadrage et autres réglages de production.' },
        speedStability: { label: 'Vitesse et stabilité', definition: 'Évaluation éditoriale de la régularité de livraison ; la médiane et le P90 observés sont publiés séparément.' },
        pricing: { label: 'Rapport valeur-prix', definition: 'Valeur de production relative au positionnement tarifaire actuel de MaxVideoAI ; les prix live restent sur les pages tarifaires et de génération.' }
      },
      methodNotes: ['Les résultats génératifs peuvent varier d’un essai à l’autre.', 'Tous les modèles ne prennent pas en charge chaque critère ou type de prompt.', 'La capacité et les files d’attente des fournisseurs évoluent.', 'Le trafic de production observé n’est pas une expérience contrôlée.', 'MaxVideoAI commercialise l’accès aux modèles comparés et déclare cet intérêt commercial.'],
      initialRelease: 'Première version des définitions, de la formule globale, du pack de prompts canonique et des règles de latence glissante.'
    },
    refundNote: 'Les générations payantes échouées sont automatiquement remboursées.',
    cta: { title: 'Choisissez le bon modèle pour votre prochain plan', body: 'Passez de la recherche aux fiches modèles, comparaisons, prix live ou à la génération.', models: 'Voir les modèles vidéo', compare: 'Comparer les modèles', pricing: 'Voir les tarifs', generate: 'Générer une vidéo' }
  },
  es: {
    meta: { title: 'Benchmarks de modelos de video IA y metodología', description: 'Compara puntuaciones editoriales de MaxVideoAI, especificaciones con fuentes y tiempos de generación medianos y P90 observados.' },
    hero: { eyebrow: 'Investigación de MaxVideoAI', title: 'Benchmarks de modelos de video IA, explicados', intro: 'Compara puntuaciones editoriales, capacidades con fuentes y tiempos de generación observados en un solo centro de investigación.', proof: 'Creado con scorecards de MaxVideoAI, especificaciones actuales y latencia de producción anonimizada.' },
    nav: { scores: 'Scorecards', specs: 'Especificaciones', speed: 'Velocidad observada', method: 'Metodología' },
    evidence: [
      { title: 'Puntuaciones editoriales', body: 'Un marco coherente de 0 a 10 para calidad, movimiento, control y uso en producción.' },
      { title: 'Especificaciones con fuentes', body: 'Capacidades actuales verificadas con fuentes del proveedor y la ruta de MaxVideoAI.' },
      { title: 'Velocidad observada', body: 'Mediana y P90 de 30 días para los modelos que cumplen el umbral interno.' }
    ],
    scores: { title: 'Scorecards de modelos', intro: 'Compara la evaluación editorial actual de MaxVideoAI en once criterios de producción.', updated: 'Puntuación actualizada', source: 'Puntuación editorial de MaxVideoAI' },
    specs: { title: 'Especificaciones verificadas', intro: 'Revisa los límites y flujos disponibles en MaxVideoAI.', source: 'Fuente', modes: 'Modos de entrada', audio: 'Audio', references: 'Referencias', modeLabels: { textToVideo: 'Texto → video', imageToVideo: 'Imagen → video', videoToVideo: 'Video → video' } },
    latency: { title: 'Tiempos de generación observados', intro: 'Mediana y P90 del tiempo total de generación durante una ventana móvil de 30 días.', median: 'Mediana', p90: 'P90', window: '30 días móviles', unavailable: 'La medición de latencia se está actualizando.', more: 'Aparecerán más modelos cuando su historial móvil esté consolidado.' },
    methodology: {
      title: 'Cómo funcionan las puntuaciones', intro: 'Un lenguaje de evaluación, una fórmula global y un pack de prompts canónico para futuras pruebas documentadas.', formula: 'Fórmula de puntuación global', prompts: 'Pack de prompts canónico', canonicalPrompt: 'Prompt canónico — inglés', limitations: 'Notas metodológicas', changelog: 'Actualizaciones de metodología',
      criteria: {
        fidelity: { label: 'Fidelidad al prompt', definition: 'Qué tan fielmente el resultado sigue los sujetos, acciones, composición y restricciones solicitados.' },
        visualQuality: { label: 'Calidad visual', definition: 'Detalle percibido, realismo, iluminación, materiales y ausencia de artefactos visibles.' },
        motion: { label: 'Realismo del movimiento', definition: 'Fluidez, plausibilidad física, movimiento de cámara y comportamiento temporal de los sujetos.' },
        consistency: { label: 'Consistencia temporal', definition: 'Estabilidad de identidades, objetos, fondos y estilos a lo largo del video.' },
        anatomy: { label: 'Fidelidad humana', definition: 'Rostros, manos, extremidades, proporciones, contacto e interacción entre personas y objetos.' },
        textRendering: { label: 'Legibilidad del texto', definition: 'Precisión y estabilidad de palabras, etiquetas, interfaces y letreros solicitados.' },
        lipsyncQuality: { label: 'Audio y sincronización labial', definition: 'Alineación entre el habla visible, el diálogo y el audio generado cuando la función está disponible.' },
        sequencingQuality: { label: 'Secuencias de varias tomas', definition: 'Continuidad, orden narrativo y preservación de identidades entre cambios de toma.' },
        controllability: { label: 'Control', definition: 'Confiabilidad de la cámara, referencias, encuadre y otros controles de producción disponibles.' },
        speedStability: { label: 'Velocidad y estabilidad', definition: 'Evaluación editorial de la consistencia de entrega; la mediana y el P90 observados se publican por separado.' },
        pricing: { label: 'Relación valor-precio', definition: 'Valor de producción relativo al precio actual en MaxVideoAI; los precios en vivo permanecen en las páginas de precios y generación.' }
      },
      methodNotes: ['Los resultados generativos pueden variar entre ejecuciones.', 'No todos los modelos admiten cada criterio o tipo de prompt.', 'La capacidad y las colas de los proveedores cambian con el tiempo.', 'El tráfico de producción observado no es un experimento controlado.', 'MaxVideoAI vende acceso a los modelos comparados y declara ese interés comercial.'],
      initialRelease: 'Primera versión de las definiciones, la fórmula global, el pack de prompts canónico y las reglas de latencia móvil.'
    },
    refundNote: 'Las generaciones pagadas que fallan se reembolsan automáticamente.',
    cta: { title: 'Elige el modelo adecuado para tu siguiente toma', body: 'Pasa de la investigación a las fichas de modelo, comparaciones, precios en vivo o generación.', models: 'Ver modelos de video', compare: 'Comparar modelos', pricing: 'Ver precios', generate: 'Generar video' }
  }
};

export function getBenchmarkCopy(locale: AppLocale): BenchmarkCopy {
  return {
    ...(COPY[locale] ?? COPY.en),
    scoreLabels: SCORE_IDS.map((id, index) => ({ id, label: SCORE_LABELS[locale][index] ?? SCORE_LABELS.en[index]! })),
  };
}
```

- [ ] **Step 4: Implement the pure page-data builder**

In `_lib/benchmark-page-data.ts`, define plain row types and implement these rules:

```ts
import { listFalEngines } from '@/config/falEngines';
import { supportsVideoGeneration } from '@/lib/models/catalog';
import { computeBenchmarkOverall, type BenchmarkLabStaticData, type BenchmarkScore } from '@/server/benchmark-lab-data';
import type { PublicBenchmarkLatencySnapshot } from '@/server/benchmark-lab-metrics';

const METRIC_IDS = ['fidelity', 'visualQuality', 'motion', 'consistency', 'anatomy', 'textRendering', 'lipsyncQuality', 'sequencingQuality', 'controllability', 'speedStability', 'pricing'] as const;

export type BenchmarkScoreRow = {
  modelSlug: string;
  modelName: string;
  overall: number | null;
  updatedAt: string | null;
  metrics: Record<(typeof METRIC_IDS)[number], number | null>;
};

export type BenchmarkSpecRow = {
  modelSlug: string;
  modelName: string;
  maxDuration: string;
  maxResolution: string;
  inputModes: Array<'textToVideo' | 'imageToVideo' | 'videoToVideo'>;
  audio: string;
  references: string;
  sourceUrl: string | null;
};

export type PublicBenchmarkMethodology = Pick<
  BenchmarkLabStaticData['methodology'],
  'version' | 'effectiveDate' | 'scoreScale' | 'overallFormula' | 'criteria' | 'promptPack' | 'limitations' | 'changelog'
>;

export type BenchmarkPageData = {
  scores: BenchmarkScoreRow[];
  specs: BenchmarkSpecRow[];
  methodology: PublicBenchmarkMethodology;
  latency: PublicBenchmarkLatencySnapshot;
};

function value(value: unknown): string {
  return value == null || String(value).trim() === '' ? '—' : String(value).trim();
}

function isSupported(value: unknown): boolean {
  return /^supported\b|^yes$|^true$/i.test(value == null ? '' : String(value).trim());
}

function metricMap(score: BenchmarkScore): BenchmarkScoreRow['metrics'] {
  return Object.fromEntries(METRIC_IDS.map((id) => [id, typeof score[id] === 'number' ? score[id] : null])) as BenchmarkScoreRow['metrics'];
}

export function buildBenchmarkPageData(
  staticData: BenchmarkLabStaticData,
  latency: PublicBenchmarkLatencySnapshot
): BenchmarkPageData {
  const engines = listFalEngines().filter((engine) => supportsVideoGeneration(engine));
  const engineBySlug = new Map(engines.map((engine) => [engine.modelSlug, engine]));
  const scoreBySlug = new Map(staticData.scores.map((score) => [score.modelSlug ?? score.engineId ?? '', score]));
  const scores = staticData.scores.flatMap((score) => {
    const modelSlug = score.modelSlug ?? score.engineId;
    const engine = modelSlug ? engineBySlug.get(modelSlug) : null;
    if (!modelSlug || !engine) return [];
    return [{ modelSlug, modelName: engine.marketingName, overall: computeBenchmarkOverall(score), updatedAt: score.last_updated ?? null, metrics: metricMap(score) }];
  }).sort((left, right) => (right.overall ?? -1) - (left.overall ?? -1) || left.modelName.localeCompare(right.modelName));

  const specs = staticData.specs.flatMap((spec) => {
    const modelSlug = spec.modelSlug ?? spec.engineId;
    const engine = modelSlug ? engineBySlug.get(modelSlug) : null;
    const score = modelSlug ? scoreBySlug.get(modelSlug) : null;
    if (!modelSlug || !engine || !score || !spec.keySpecs) return [];
    const inputModes = [
      isSupported(spec.keySpecs.textToVideo) ? 'textToVideo' : null,
      isSupported(spec.keySpecs.imageToVideo) ? 'imageToVideo' : null,
      isSupported(spec.keySpecs.videoToVideo) ? 'videoToVideo' : null,
    ].filter((entry): entry is 'textToVideo' | 'imageToVideo' | 'videoToVideo' => Boolean(entry));
    return [{
      modelSlug,
      modelName: engine.marketingName,
      maxDuration: value(spec.keySpecs.maxDuration),
      maxResolution: value(spec.keySpecs.maxResolution),
      inputModes,
      audio: value(spec.keySpecs.nativeAudioGeneration ?? spec.keySpecs.audioOutput),
      references: value(spec.keySpecs.referenceImageStyle ?? spec.keySpecs.referenceVideo),
      sourceUrl: spec.sources?.find((url) => !url.includes('maxvideoai.com')) ?? spec.sources?.[0] ?? null,
    }];
  }).sort((left, right) => left.modelName.localeCompare(right.modelName));

  const methodology: PublicBenchmarkMethodology = {
    version: staticData.methodology.version,
    effectiveDate: staticData.methodology.effectiveDate,
    scoreScale: staticData.methodology.scoreScale,
    overallFormula: staticData.methodology.overallFormula,
    criteria: staticData.methodology.criteria,
    promptPack: staticData.methodology.promptPack,
    limitations: staticData.methodology.limitations,
    changelog: staticData.methodology.changelog,
  };

  return { scores, specs, methodology, latency };
}
```

- [ ] **Step 5: Implement schema builders and the route wrapper**

Use `buildSeoMetadata({ locale, englishPath: '/benchmarks', titleBranding: 'none' })`, `buildMetadataUrls()`, `JsonLd`, and `localeRegions`. The complete route wrapper must stay equivalent to:

```tsx
import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { localeRegions } from '@/i18n/locales';
import { JsonLd } from '@/components/SeoJsonLd';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { loadBenchmarkLabStaticData } from '@/server/benchmark-lab-data';
import { fetchPublicBenchmarkLatency } from '@/server/benchmark-lab-metrics';
import { BenchmarkLabView } from './_components/BenchmarkLabView';
import { getBenchmarkCopy } from './_lib/benchmark-copy';
import { buildBenchmarkPageData } from './_lib/benchmark-page-data';
import { buildBenchmarkBreadcrumbJsonLd, buildBenchmarkWebPageJsonLd } from './_lib/benchmark-schema';

export const revalidate = 21600;

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const { locale } = await params;
  const copy = getBenchmarkCopy(locale);
  return buildSeoMetadata({
    locale,
    englishPath: '/benchmarks',
    title: copy.meta.title,
    description: copy.meta.description,
    titleBranding: 'none',
    keywords: ['AI video benchmarks', 'AI video model scores', 'AI video generation speed', 'MaxVideoAI methodology'],
    imageAlt: copy.hero.title,
  });
}

export default async function BenchmarkLabPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const copy = getBenchmarkCopy(locale);
  const [staticData, latency] = await Promise.all([loadBenchmarkLabStaticData(), fetchPublicBenchmarkLatency()]);
  const data = buildBenchmarkPageData(staticData, latency);
  const canonicalUrl = buildMetadataUrls(locale, undefined, { englishPath: '/benchmarks' }).canonical;
  return (
    <>
      <JsonLd json={buildBenchmarkWebPageJsonLd({ canonicalUrl, copy, inLanguage: localeRegions[locale], modifiedAt: data.methodology.effectiveDate })} />
      <JsonLd json={buildBenchmarkBreadcrumbJsonLd({ canonicalUrl, copy })} />
      <BenchmarkLabView copy={copy} data={data} locale={locale} />
    </>
  );
}
```

`benchmark-schema.ts` must build only `WebPage` and `BreadcrumbList`, with MaxVideoAI as publisher and no `Dataset` payload. Add `'/benchmarks'` to `MARKETING_CORE_PATHS` in `frontend/next-sitemap.config.js`; the existing localized sitemap expansion will then emit the English, French, and Spanish URLs.

- [ ] **Step 6: Add a temporary view contract so the route compiles**

Create `_components/BenchmarkLabView.tsx` as a minimal Server Component returning the hero title and section anchors. Task 4 replaces the minimal markup without changing its props:

```tsx
import type { AppLocale } from '@/i18n/locales';
import type { BenchmarkCopy } from '../_lib/benchmark-copy';
import type { BenchmarkPageData } from '../_lib/benchmark-page-data';

export function BenchmarkLabView({ copy }: { copy: BenchmarkCopy; data: BenchmarkPageData; locale: AppLocale }) {
  return <main><h1>{copy.hero.title}</h1></main>;
}
```

- [ ] **Step 7: Run route and data tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/benchmark-lab-data.test.ts tests/benchmark-lab-metrics.test.ts tests/benchmark-lab-route.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 8: Commit the route foundation**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/benchmarks' frontend/next-sitemap.config.js tests/benchmark-lab-route.test.ts
git commit -m "feat: add benchmark lab route foundation"
```

---

### Task 4: Build the polished responsive Benchmark Lab presentation

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkLabView.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkScoreTable.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkSpecsTable.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkLatencySection.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkMethodologySection.tsx`
- Modify: `tests/benchmark-lab-route.test.ts`

**Interfaces:**
- Consumes: `BenchmarkPageData`, `BenchmarkCopy`, `AppLocale`
- Produces: one server-rendered, no-client-JavaScript research page

### Visual contract

- Hero: quiet research aesthetic, subtle brand-blue radial glow, small `MaxVideoAI Research` eyebrow, 48–64px headline, restrained proof line.
- Evidence strip: three equal cards for editorial scores, sourced specs, and observed speed. The first two cards may display the dynamic model-row counts (`data.scores.length` and `data.specs.length`); never display generation, job, or user counts.
- Anchor navigation: sticky-under-header pill bar linking `#scorecards`, `#specifications`, `#observed-speed`, and `#methodology`.
- Score matrix: rounded 24px surface, sticky model column, compact 0–10 cells, thin horizontal score bars, horizontal touch scrolling, no chart library.
- Specs matrix: separate semantic table so facts never look like editorial grades.
- Latency: two-number cards per eligible model, large median, quieter P90, no counts or rates.
- Methodology: formula card, criterion grid, eight native `<details>` prompt accordions, method notes, changelog.
- CTA: compact four-link footer card; it must not compete with the research content.
- Mobile: no clipped text, tables scroll inside their own containers, tap targets at least 40px, sticky first column remains readable.
- Dark mode: use existing tokens and translucent neutral surfaces; no light-only hard-coded backgrounds.

- [ ] **Step 1: Strengthen the failing visual architecture test**

Append to `tests/benchmark-lab-route.test.ts`:

```ts
test('benchmark lab presentation stays split into focused server components', () => {
  const components = ['BenchmarkLabView', 'BenchmarkScoreTable', 'BenchmarkSpecsTable', 'BenchmarkLatencySection', 'BenchmarkMethodologySection'];
  for (const component of components) {
    const file = path.join(routeRoot, '_components', `${component}.tsx`);
    assert.ok(existsSync(file), `${component} should exist`);
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /['\"]use client['\"]/);
  }
  const view = readFileSync(path.join(routeRoot, '_components/BenchmarkLabView.tsx'), 'utf8');
  const scoreTable = readFileSync(path.join(routeRoot, '_components/BenchmarkScoreTable.tsx'), 'utf8');
  const specsTable = readFileSync(path.join(routeRoot, '_components/BenchmarkSpecsTable.tsx'), 'utf8');
  const methodology = readFileSync(path.join(routeRoot, '_components/BenchmarkMethodologySection.tsx'), 'utf8');
  assert.match(view, /id="scorecards"/);
  assert.match(view, /id="specifications"/);
  assert.match(view, /id="observed-speed"/);
  assert.match(view, /id="methodology"/);
  assert.match(scoreTable, /overflow-x-auto/);
  assert.match(specsTable, /overflow-x-auto/);
  assert.match(view, /Failed paid generations are automatically refunded\.|refundNote/);
  assert.doesNotMatch(view, /success rate|generation count|distinct users|failed jobs refunded/i);
  assert.doesNotMatch(methodology, /minimumCompletedJobs|minimumDistinctUsers|sampleSize/);
});
```

- [ ] **Step 2: Run the test and verify missing component failures**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/benchmark-lab-route.test.ts
```

Expected: FAIL for the four missing focused section components.

- [ ] **Step 3: Implement the score and specification tables**

`BenchmarkScoreTable` must render a semantic `<table className="min-w-[1180px]">` inside `overflow-x-auto`, keep the model cell `sticky left-0`, link each model name with the localized `Link` route `{ pathname: '/models/[slug]', params: { slug: row.modelSlug } }`, render overall as a brand score badge, render each metric as a number plus a CSS width bar, format recorded dates for `locale`, and omit a date when `updatedAt` is null.

`BenchmarkSpecsTable` must render a separate `<table className="min-w-[980px]">` with columns for model, max duration, max resolution, input modes, audio, references, and one external source link. Link model names through the same localized model route, map each `inputModes` key through `copy.specs.modeLabels`, and use `rel="noreferrer"` plus an `ExternalLink` icon on source links.

The score cell implementation must use this deterministic bar width:

```tsx
function ScoreValue({ value }: { value: number | null }) {
  if (value == null) return <span className="text-text-muted">—</span>;
  const width = `${Math.max(0, Math.min(100, value * 10))}%`;
  return (
    <div className="min-w-[72px]">
      <span className="text-sm font-semibold tabular-nums text-text-primary">{value.toFixed(1)}</span>
      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-subtle">
        <span className="block h-full rounded-full bg-brand/70" style={{ width }} />
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Implement latency and methodology sections**

`BenchmarkLatencySection` renders nothing numerical when `status === 'unavailable'`; it shows the localized refresh copy. For available rows it resolves the display name from the matching `BenchmarkScoreRow`, links it to the localized model route, formats milliseconds with `Intl.NumberFormat` into `Xm Ys` or `Ys`, and renders only model name, median, P90, rolling-window label, and `asOf` date. When the snapshot is available but has no eligible rows, render `copy.latency.more` with no empty zero values.

`BenchmarkMethodologySection` must:

- show `(${copy.methodology.criteria.fidelity.label} + ${copy.methodology.criteria.motion.label} + ${copy.methodology.criteria.consistency.label}) ÷ 3` in a dedicated formula card so the formula is localized without changing its fields;
- map every methodology criterion into a compact definition card using `copy.methodology.criteria[criterion.id]` for the localized label and definition;
- render eight `<details>` accordions with the unchanged English prompt text;
- show `copy.methodology.canonicalPrompt` on every prompt;
- leave `operationalLatency.minimumCompletedJobs`, `operationalLatency.minimumDistinctUsers`, and the `sampleSize` entry from `requiredRunMetadata` out of rendered copy and markup;
- render `copy.methodology.methodNotes` and pair each methodology changelog date/version with `copy.methodology.initialRelease`, without unfinished markers, test claims, or missing-data warnings.

- [ ] **Step 5: Replace the temporary view with the complete visual composition**

`BenchmarkLabView` must compose the hero, three evidence cards, anchor navigation, score table, specs table, latency cards, method section, refund note, and CTA. Use `overflow-x-clip bg-bg text-text-primary` on the outer `<main>`, `relative overflow-hidden border-b border-hairline px-4 py-16 sm:px-8 sm:py-24` on the hero, `sticky top-[var(--header-height)] z-20 border-b border-hairline bg-bg/90 backdrop-blur` on the anchor navigation, and `container-page max-w-[1240px] space-y-16 py-10 sm:space-y-24 sm:py-16` on the content wrapper.

Use `FlaskConical`, `Gauge`, `ShieldCheck`, `Database`, `Clock3`, `ExternalLink`, and `ArrowRight` only through `UIIcon` or direct Lucide components with `aria-hidden`.

- [ ] **Step 6: Run focused tests and lint the route**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/benchmark-lab-route.test.ts tests/benchmark-lab-data.test.ts tests/benchmark-lab-metrics.test.ts
pnpm --prefix frontend exec eslint 'app/(localized)/[locale]/(marketing)/benchmarks/**/*.{ts,tsx}' --no-error-on-unmatched-pattern
```

Expected: all tests pass and ESLint reports 0 errors.

- [ ] **Step 7: Commit the presentation**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/benchmarks' tests/benchmark-lab-route.test.ts
git commit -m "feat: design benchmark lab presentation"
```

---

### Task 5: Link the methodology from existing score surfaces

**Files:**
- Create: `frontend/components/marketing/BenchmarkMethodologyLink.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareScorecardSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareDetailContent.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelSpecsSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogRecommendedSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/page.tsx`
- Modify: `tests/compare-page-architecture.test.ts`
- Modify: `tests/model-page-layout-architecture.test.ts`
- Modify: `tests/models-catalog-architecture.test.ts`
- Modify: `tests/benchmark-lab-route.test.ts`

**Interfaces:**
- Produces: `<BenchmarkMethodologyLink locale variant />`
- Consumes: `localizePathFromEnglish(locale, '/benchmarks')`

- [ ] **Step 1: Write failing shared-link integration assertions**

Add source-contract assertions:

```ts
assert.match(scorecardSectionSource, /BenchmarkMethodologyLink/);
assert.match(scorecardSectionSource, /activeLocale/);
```

to `tests/compare-page-architecture.test.ts`.

Add:

```ts
const modelPageSource = readSource(path.join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx'));
assert.match(modelPageSource, /loadBenchmarkScoreSlugs/);
assert.match(layoutSource, /showBenchmarkLink/);
assert.match(readSource(path.join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelSpecsSection.tsx')), /BenchmarkMethodologyLink/);
```

to `tests/model-page-layout-architecture.test.ts`.

Add:

```ts
assert.match(recommendedSource, /BenchmarkMethodologyLink/);
assert.match(pageSource, /locale=\{activeLocale\}/);
```

to `tests/models-catalog-architecture.test.ts`.

Add a benchmark route assertion that `frontend/components/marketing/BenchmarkMethodologyLink.tsx` includes `/benchmarks`, `en`, `fr`, and `es` labels.

- [ ] **Step 2: Run the four test files and verify failures**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/benchmark-lab-route.test.ts tests/compare-page-architecture.test.ts tests/model-page-layout-architecture.test.ts tests/models-catalog-architecture.test.ts
```

Expected: FAIL because the shared component and integrations do not exist.

- [ ] **Step 3: Create the shared localized methodology link**

Create `frontend/components/marketing/BenchmarkMethodologyLink.tsx`:

```tsx
import clsx from 'clsx';
import { FlaskConical } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import { localizePathFromEnglish } from '@/lib/i18n/paths';

const LABELS: Record<AppLocale, string> = {
  en: 'How we benchmark',
  fr: 'Notre méthodologie',
  es: 'Cómo evaluamos',
};

export function BenchmarkMethodologyLink({
  locale,
  variant = 'inline',
  className,
}: {
  locale: AppLocale;
  variant?: 'inline' | 'pill';
  className?: string;
}) {
  return (
    <Link
      href={localizePathFromEnglish(locale, '/benchmarks')}
      className={clsx(
        'inline-flex items-center gap-1.5 font-semibold text-brand transition hover:text-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        variant === 'pill' && 'min-h-10 rounded-full border border-brand/20 bg-brand/5 px-3 text-xs',
        variant === 'inline' && 'text-xs underline-offset-4 hover:underline',
        className
      )}
    >
      <FlaskConical className="h-3.5 w-3.5" aria-hidden />
      {LABELS[locale]}
    </Link>
  );
}
```

- [ ] **Step 4: Add the link to comparison score surfaces**

Add `activeLocale: AppLocale` to `CompareScorecardSectionProps`, render `<BenchmarkMethodologyLink locale={activeLocale} className="mt-3" />` under the scorecard subtitle, and pass `activeLocale` from `CompareDetailContent`.

On the comparison hub, render `<BenchmarkMethodologyLink locale={locale} variant="pill" />` directly below `CompareNowWidget`, centered with the quick-start links.

- [ ] **Step 5: Add the link to model score surfaces without linking image-only pages**

In the existing async `renderMarketingModelPage()` function in `models/[slug]/page.tsx`, call the cached `loadBenchmarkScoreSlugs()` after `isVideoEngine` is known, then compute:

```ts
const benchmarkScoreSlugs = await loadBenchmarkScoreSlugs();
const showBenchmarkLink = isVideoEngine && benchmarkScoreSlugs.has(engine.modelSlug);
```

Pass `showBenchmarkLink` into `MarketingModelPageLayout`. The layout must remain synchronous: accept the boolean prop, include it in `specsProps`, and perform no filesystem or server-data reads. Extend `ModelSpecsSectionProps` with `showBenchmarkLink?: boolean` and render `<BenchmarkMethodologyLink locale={locale} variant="pill" />` in both the decision and default spec section headers when true.

Pass `locale={activeLocale}` into `ModelsCatalogRecommendedSection` and render the pill link beside the existing `See all models` action because that section visibly displays overall scores. Do not add it to image-only cards.

- [ ] **Step 6: Run focused integration tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/benchmark-lab-route.test.ts tests/compare-page-architecture.test.ts tests/model-page-layout-architecture.test.ts tests/models-catalog-architecture.test.ts
```

Expected: all focused integration and architecture tests pass.

- [ ] **Step 7: Commit the methodology links**

```bash
git add frontend/components/marketing/BenchmarkMethodologyLink.tsx \
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines' \
  'frontend/app/(localized)/[locale]/(marketing)/models' \
  tests/benchmark-lab-route.test.ts tests/compare-page-architecture.test.ts \
  tests/model-page-layout-architecture.test.ts tests/models-catalog-architecture.test.ts
git commit -m "feat: link score surfaces to benchmark methodology"
```

---

### Task 6: Verify SEO, privacy, responsive design, and full regression safety

**Files:**
- Modify only if verification finds a defect in files already listed above.

**Interfaces:**
- Verifies the completed feature; introduces no new public behavior.

- [ ] **Step 1: Run the focused Benchmark Lab suite**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/benchmark-lab-data.test.ts \
  tests/benchmark-lab-metrics.test.ts \
  tests/benchmark-lab-route.test.ts \
  tests/compare-page-architecture.test.ts \
  tests/model-page-layout-architecture.test.ts \
  tests/models-catalog-architecture.test.ts \
  tests/schema-sitemap-architecture.test.ts
```

Expected: all tests pass, 0 fail.

- [ ] **Step 2: Run static exposure and formatting guards**

```bash
pnpm --prefix frontend run lint
pnpm run lint:exposure
git diff --check origin/main...HEAD
```

Expected: all commands exit 0.

- [ ] **Step 3: Run the full validation suite**

```bash
pnpm test:validate
```

Expected: at least 1,771 tests pass plus the new Benchmark Lab tests, 0 fail. If the suite regenerates the two comparison indexation matrix artifacts, restore only those generated files before final review and do not commit them.

- [ ] **Step 4: Build the production application**

```bash
pnpm --prefix frontend run build
```

Expected: build and postbuild sitemap generation exit 0. Confirm the build output lists the localized Benchmark Lab route without a server/client boundary error.

- [ ] **Step 5: Start a local production server for browser QA**

```bash
pnpm --prefix frontend run start -- --port 3100
```

Use the browser to inspect:

- `http://localhost:3100/benchmarks`
- `http://localhost:3100/fr/benchmarks`
- `http://localhost:3100/es/benchmarks`
- one scored model page in each locale;
- one comparison page in each locale;
- the models hub and comparison hub.

Expected visual results:

- hero hierarchy is balanced at 390px, 768px, 1280px, and 1440px widths;
- no table escapes its rounded scroll container;
- sticky model columns remain readable in light and dark themes;
- score bars and numeric values remain aligned;
- latency cards expose no sample, user, failure, success, or refund rate;
- canonical prompt accordions display unchanged English prompt text in every locale;
- the refund sentence is direct and contains no admin or percentage caveat;
- shared methodology links are visible but secondary to the primary task;
- keyboard Tab order reaches anchor navigation, source links, prompt accordions, and CTAs;
- no horizontal page-level scrollbar appears.

- [ ] **Step 6: Inspect metadata, JSON-LD, and sitemap output**

For each locale route, verify:

- self-canonical URL;
- reciprocal `en-US`, `fr-FR`, `es-419`, and `x-default` hreflang values;
- `index,follow` behavior;
- one `WebPage` and one `BreadcrumbList` JSON-LD payload;
- no `Dataset` payload;
- inclusion in the matching localized sitemap;
- no changes to existing model or comparison sitemap entries.

- [ ] **Step 7: Run a public-data string audit**

```bash
rg -n -i "success rate|failed jobs|distinct users|completed jobs|sample size|minimumCompletedJobs|minimumDistinctUsers|admin refund|manual refund" \
  'frontend/app/(localized)/[locale]/(marketing)/benchmarks' \
  frontend/components/marketing/BenchmarkMethodologyLink.tsx
```

Expected: no public UI copy or component prop exposes production volumes, rates, eligibility thresholds, or admin refund language. The future-run `sampleSize` requirement may exist only in the versioned data file and server-side static type; it does not enter `BenchmarkPageData` or rendered markup.

- [ ] **Step 8: Review the final diff and commit any verification-only correction**

```bash
git status --short
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
git log --oneline origin/main..HEAD
```

Expected: only the Benchmark Lab plan, data, route, shared link, focused integrations, and tests are present. If QA required a correction, commit it with:

```bash
git add data/benchmarks/benchmark-methodology.v1.json \
  frontend/server/benchmark-lab-data.ts frontend/server/benchmark-lab-metrics.ts \
  'frontend/app/(localized)/[locale]/(marketing)/benchmarks' \
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines' \
  'frontend/app/(localized)/[locale]/(marketing)/models' \
  frontend/next-sitemap.config.js \
  frontend/components/marketing/BenchmarkMethodologyLink.tsx \
  tests/benchmark-lab-data.test.ts tests/benchmark-lab-metrics.test.ts \
  tests/benchmark-lab-route.test.ts tests/compare-page-architecture.test.ts \
  tests/model-page-layout-architecture.test.ts tests/models-catalog-architecture.test.ts
git commit -m "fix: polish benchmark lab verification"
```

Do not push, merge, or delete the branch until the user explicitly approves the completed implementation.
