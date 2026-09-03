import { NextResponse, type NextRequest } from 'next/server';
import {
  getConfiguredEngineIncludingHidden,
  getPublicConfiguredEnginesByCategory,
} from '@/server/engines';
import { fetchEngineAverageDurations } from '@/server/generate-metrics';
import { loadAppEngineScoreMap } from '@/server/engine-scores';
import { getBaseEnginesByCategory } from '@/lib/engines';
import { resolveLaunchCanaryRequestContext } from '@/server/model-launch-canary-request';
import { resolveAgentGenerationModeExecutability } from '@/server/agent-runtime/model-executability';
import type { EngineCaps, Mode } from '@/types/engines';

export const dynamic = 'force-dynamic';

type EnginesRouteDependencies = Readonly<{
  getPublicConfiguredEnginesByCategory: typeof getPublicConfiguredEnginesByCategory;
  getConfiguredEngineIncludingHidden: typeof getConfiguredEngineIncludingHidden;
  resolveLaunchCanaryRequestContext: typeof resolveLaunchCanaryRequestContext;
  fetchEngineAverageDurations: typeof fetchEngineAverageDurations;
  loadAppEngineScoreMap: typeof loadAppEngineScoreMap;
}>;

const defaultDependencies: EnginesRouteDependencies = {
  getPublicConfiguredEnginesByCategory,
  getConfiguredEngineIncludingHidden,
  resolveLaunchCanaryRequestContext,
  fetchEngineAverageDurations,
  loadAppEngineScoreMap,
};

function privateWorkspaceProjection(engine: EngineCaps, modes: readonly Mode[]): EngineCaps {
  const safeEngine = { ...engine };
  delete safeEngine.providerMeta;
  return {
    ...safeEngine,
    modes: [...modes],
    modeCaps: engine.modeCaps
      ? Object.fromEntries(
          modes.flatMap((mode) => engine.modeCaps?.[mode]
            ? [[mode, engine.modeCaps[mode]]]
            : []),
        )
      : undefined,
  };
}

export function createEnginesGetHandler(
  dependencyOverrides: Partial<EnginesRouteDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  return async function enginesGet(request: NextRequest) {
    const rawCategory = request.nextUrl.searchParams.get('category') ?? 'video';
    const category = rawCategory === 'image' || rawCategory === 'all' ? rawCategory : 'video';
    const includeAverages =
      category !== 'image' && request.nextUrl.searchParams.get('includeAverages') === '1';
    const includeScores = category !== 'image';
    try {
      const [publicEngines, averages, engineScores, launchCanaryContext] = await Promise.all([
        dependencies.getPublicConfiguredEnginesByCategory(category),
        includeAverages ? dependencies.fetchEngineAverageDurations() : Promise.resolve([]),
        includeScores ? dependencies.loadAppEngineScoreMap() : Promise.resolve({}),
        category === 'image'
          ? Promise.resolve(null)
          : dependencies.resolveLaunchCanaryRequestContext(request),
      ]);
      const privateEngines: EngineCaps[] = [];
      if (launchCanaryContext) {
        for (const engineId of launchCanaryContext.access.allowedModelIds) {
          const engine = await dependencies.getConfiguredEngineIncludingHidden(engineId);
          if (!engine || publicEngines.some((candidate) => candidate.id === engine.id)) continue;
          const executableModes = engine.modes.filter((mode) =>
            resolveAgentGenerationModeExecutability(
              engine,
              mode,
              launchCanaryContext.generationEnvironment,
            ).executable,
          );
          if (executableModes.length) {
            privateEngines.push(privateWorkspaceProjection(engine, executableModes));
          }
        }
      }
      const averageMap = new Map(averages.map((entry) => [entry.engineId, entry.averageDurationMs]));
      const payload = [...publicEngines, ...privateEngines].map((engine) => ({
        ...engine,
        avgDurationMs: averageMap.get(engine.id) ?? null,
      }));
      return NextResponse.json(
        { ok: true, engines: payload, engineScores },
        {
          headers: {
            'Cache-Control': 'private, no-store',
            Vary: 'Authorization, Cookie',
          },
        },
      );
    } catch (error) {
      console.error('[api/engines] failed to load configured engines, falling back to base registry', error);
      const payload = getBaseEnginesByCategory(category).map((engine) => ({
        ...engine,
        avgDurationMs: null,
      }));
      return NextResponse.json(
        { ok: true, engines: payload, engineScores: {}, degraded: true },
        {
          headers: {
            'Cache-Control': 'private, no-store',
            Vary: 'Authorization, Cookie',
          },
        },
      );
    }
  };
}

export const GET = createEnginesGetHandler();
