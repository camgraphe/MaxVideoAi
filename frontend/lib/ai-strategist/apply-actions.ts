import { AI_STRATEGIST_MODELS } from './model-catalog';

type AiStrategistApplyAction = {
  type: string;
  value?: string | null;
};

type AiStrategistApplyEngine = {
  id: string;
  label?: string | null;
};

type AiStrategistApplyResultLike = {
  selectedModel?: string | null;
  uiActions?: readonly AiStrategistApplyAction[];
};

const GENERIC_MODEL_ALIASES: Record<string, string> = {
  seedance: 'seedance-2-0',
  sidance: 'seedance-2-0',
  kling: 'kling-3-pro',
  veo: 'veo-3-1',
  ltx: 'ltx-2-3',
  pika: 'pika',
  hailuo: 'hailuo',
  sora: 'sora',
  happyhorse: 'happy-horse-1-0',
};

export function resolveAiStrategistApplyEngineId({
  engines,
  result,
}: {
  engines: readonly AiStrategistApplyEngine[];
  result: AiStrategistApplyResultLike;
}): string | null {
  const candidates = buildModelCandidates(result);

  for (const candidate of candidates) {
    const exact = findEngineByToken(engines, candidate);
    if (exact) return exact.id;
  }

  for (const candidate of candidates) {
    const catalogModel = findCatalogModelByToken(candidate);
    if (!catalogModel) continue;
    const catalogCandidates = [
      catalogModel.id,
      catalogModel.label,
      ...(catalogModel.appEngineAliases ?? []),
    ];
    for (const catalogCandidate of catalogCandidates) {
      const exact = findEngineByToken(engines, catalogCandidate);
      if (exact) return exact.id;
    }
  }

  return null;
}

export function findAiStrategistActionValue(
  actions: readonly AiStrategistApplyAction[] | undefined,
  type: string
): string | undefined {
  const value = actions?.find((action) => action.type === type)?.value;
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function buildModelCandidates(result: AiStrategistApplyResultLike): string[] {
  const candidates = [
    findAiStrategistActionValue(result.uiActions, 'SET_MODEL'),
    result.selectedModel ?? undefined,
  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim()));

  const expanded = new Set<string>();
  for (const candidate of candidates) {
    expanded.add(candidate);
    const generic = GENERIC_MODEL_ALIASES[normalizeModelToken(candidate)];
    if (generic) expanded.add(generic);
  }
  return [...expanded];
}

function findEngineByToken(
  engines: readonly AiStrategistApplyEngine[],
  candidate: string
): AiStrategistApplyEngine | null {
  const token = normalizeModelToken(candidate);
  if (!token) return null;
  return (
    engines.find((engine) => normalizeModelToken(engine.id) === token) ??
    engines.find((engine) => normalizeModelToken(engine.label ?? '') === token) ??
    null
  );
}

function findCatalogModelByToken(candidate: string) {
  const token = normalizeModelToken(candidate);
  if (!token) return null;
  return (
    AI_STRATEGIST_MODELS.find((model) => normalizeModelToken(model.id) === token) ??
    AI_STRATEGIST_MODELS.find((model) => normalizeModelToken(model.label) === token) ??
    AI_STRATEGIST_MODELS.find((model) =>
      (model.appEngineAliases ?? []).some((alias) => normalizeModelToken(alias) === token)
    ) ??
    null
  );
}

function normalizeModelToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}
