import type {
  EngineInputSchema,
  EngineReferenceBudget,
  Mode,
} from '@/types/engines';

export type ResolvedEngineReferenceBudget = Omit<EngineReferenceBudget, 'modes'>;
export type ReferenceBudgetValuesByField<T> = Record<
  string,
  readonly T[] | undefined
>;
export type ReferenceBudgetMediaItem = {
  fieldId: string;
  kind: 'image' | 'video' | 'audio';
  url: string;
};
export type ReferenceBudgetEvaluation =
  | { ok: true; count: number; maxTotal: number }
  | { ok: false; count: number; maxTotal: number };

export function resolveEngineReferenceBudget(
  inputSchema: EngineInputSchema | null | undefined,
  mode: Mode
): ResolvedEngineReferenceBudget | null {
  const budget = inputSchema?.referenceBudget;
  if (!budget || budget.maxTotal < 1 || (budget.modes?.length && !budget.modes.includes(mode))) {
    return null;
  }
  const fields = [...(inputSchema.required ?? []), ...(inputSchema.optional ?? [])];
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const fieldIds = budget.fieldIds.filter((fieldId, index, list) => {
    if (list.indexOf(fieldId) !== index) return false;
    const field = fieldsById.get(fieldId);
    return Boolean(field && (!field.modes?.length || field.modes.includes(mode)));
  });
  return fieldIds.length
    ? {
        fieldIds,
        maxTotal: budget.maxTotal,
        countUniqueUrls: budget.countUniqueUrls,
      }
    : null;
}

export function resolveEngineReferenceBudgetForValues<T>(
  inputSchema: EngineInputSchema | null | undefined,
  preferredMode: Mode,
  valuesByField: ReferenceBudgetValuesByField<T>,
  getIdentity: (value: T) => string | null | undefined,
  prospectiveFieldId?: string
): ResolvedEngineReferenceBudget | null {
  const budget = inputSchema?.referenceBudget;
  if (!budget) return null;
  const fields = [...(inputSchema?.required ?? []), ...(inputSchema?.optional ?? [])];
  const candidateModes = Array.from(
    new Set<Mode>([
      preferredMode,
      ...(budget.modes ?? []),
      ...fields
        .filter((field) => budget.fieldIds.includes(field.id))
        .flatMap((field) => field.modes ?? []),
    ])
  );
  let best:
    | {
        budget: ResolvedEngineReferenceBudget;
        score: number;
      }
    | null = null;
  for (const candidateMode of candidateModes) {
    const candidate = resolveEngineReferenceBudget(inputSchema, candidateMode);
    if (!candidate) continue;
    const populatedFieldCount = candidate.fieldIds.filter((fieldId) =>
      (valuesByField[fieldId] ?? []).some((value) =>
        Boolean(getIdentity(value)?.trim())
      )
    ).length;
    if (populatedFieldCount === 0) continue;
    const score =
      populatedFieldCount * 10 +
      (prospectiveFieldId && candidate.fieldIds.includes(prospectiveFieldId)
        ? 100
        : 0) +
      (candidateMode === preferredMode ? 1 : 0);
    if (!best || score > best.score) best = { budget: candidate, score };
  }
  return best?.budget ?? null;
}

export function evaluateReferenceBudget<T>(params: {
  budget: ResolvedEngineReferenceBudget;
  valuesByField: ReferenceBudgetValuesByField<T>;
  getIdentity: (value: T) => string | null | undefined;
}): ReferenceBudgetEvaluation {
  const identities: string[] = [];
  for (const fieldId of params.budget.fieldIds) {
    for (const value of params.valuesByField[fieldId] ?? []) {
      const identity = params.getIdentity(value)?.trim();
      if (identity) identities.push(identity);
    }
  }
  const count = params.budget.countUniqueUrls
    ? new Set(identities).size
    : identities.length;
  return {
    ok: count <= params.budget.maxTotal,
    count,
    maxTotal: params.budget.maxTotal,
  };
}

export function buildReferenceMediaItems(
  inputSchema: EngineInputSchema,
  mode: Mode,
  valuesByField: ReferenceBudgetValuesByField<string>
): ReferenceBudgetMediaItem[] {
  const fields = [...(inputSchema.required ?? []), ...(inputSchema.optional ?? [])];
  return fields.flatMap((field) => {
    if (field.modes?.length && !field.modes.includes(mode)) return [];
    const fieldId = field.id;
    const kind = field.type;
    if (kind !== 'image' && kind !== 'video' && kind !== 'audio') return [];
    return (valuesByField[fieldId] ?? [])
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => ({ fieldId, kind, url }));
  });
}
