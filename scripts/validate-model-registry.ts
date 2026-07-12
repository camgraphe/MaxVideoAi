import registry from '../frontend/config/model-registry.json' with { type: 'json' };
import { validateModelRegistryDocument } from '../frontend/config/model-registry-validation.ts';

const validated = validateModelRegistryDocument(registry);
console.log(
  `[model-registry] valid (${validated.models.length} models, ${validated.tombstones.length} tombstones)`
);
