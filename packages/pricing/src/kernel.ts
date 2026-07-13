import type { PricingEngineDefinition, PricingKernel } from './types';

export function createPricingKernel(definitions: PricingEngineDefinition[]): PricingKernel {
  const map = new Map<string, PricingEngineDefinition>();
  const primaryIds: PricingEngineDefinition[] = [];

  function normaliseDefinition(definition: PricingEngineDefinition): PricingEngineDefinition {
    return {
      ...definition,
      resolutionMultipliers: { ...definition.resolutionMultipliers },
      durationSteps: { ...definition.durationSteps },
      addons: definition.addons ? { ...definition.addons } : undefined,
      metadata: definition.metadata ? { ...definition.metadata } : undefined,
    };
  }

  function aliasVariants(engineId: string): string[] {
    const variants = new Set<string>();
    variants.add(engineId);
    variants.add(engineId.toLowerCase());
    const camelToKebab = engineId
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[_\s]+/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
    variants.add(camelToKebab);
    const digitsToKebab = engineId
      .replace(/([a-zA-Z])(\d+)/g, '$1-$2')
      .replace(/[_\s]+/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
    variants.add(digitsToKebab);
    return Array.from(variants).filter((value) => value.length > 0);
  }

  definitions.forEach((definition) => {
    const normalised = normaliseDefinition(definition);
    primaryIds.push(normalised);
    aliasVariants(definition.engineId).forEach((alias) => {
      if (!map.has(alias)) {
        map.set(alias, normalised);
      }
    });
  });

  return {
    listDefinitions() {
      return primaryIds.map((definition) => normaliseDefinition(definition));
    },
    getDefinition(engineId: string) {
      const def = map.get(engineId);
      return def ? normaliseDefinition(def) : undefined;
    },
    getDurations(engineId: string) {
      const def = map.get(engineId);
      return def ? { ...def.durationSteps } : undefined;
    },
  };
}
