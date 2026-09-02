export function buildModelRuntimeProjection(source) {
  const modelsById = new Map(source.models.map((model) => [model.id.toLowerCase(), model]));

  function resolvePublicTargetId(sourceModel) {
    const visited = new Set();
    let model = sourceModel;
    while (model.replacement) {
      const key = model.id.toLowerCase();
      if (visited.has(key)) throw new Error(`model-runtime: replacement cycle at "${model.id}"`);
      visited.add(key);
      const target = modelsById.get(model.replacement.toLowerCase());
      if (!target) throw new Error(`model-runtime: missing replacement target "${model.replacement}"`);
      model = target;
    }
    return model.id;
  }

  function resolveSuccessorSlug(sourceModel) {
    if (!sourceModel.successorId) return null;
    const target = modelsById.get(sourceModel.successorId.toLowerCase());
    if (!target) throw new Error(`model-runtime: missing successor target "${sourceModel.successorId}"`);
    return target.slug;
  }

  return {
    schemaVersion: source.schemaVersion,
    models: source.models.map((sourceModel) => {
      const { replacement: _replacement, ...model } = sourceModel;
      return {
        ...model,
        successorSlug: resolveSuccessorSlug(sourceModel),
        ...(sourceModel.replacement ? { publicTargetId: resolvePublicTargetId(sourceModel) } : {}),
      };
    }),
  };
}
