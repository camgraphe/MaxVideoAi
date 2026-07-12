import { resolve } from 'node:path';
import registry from '../frontend/config/model-registry.json' with { type: 'json' };
import {
  validateModelRegistryDocument,
  validateModelRegistryRepository,
} from '../frontend/config/model-registry-validation.ts';

const validated = validateModelRegistryDocument(registry);
validateModelRegistryRepository(validated, resolve('.'));
console.log(
  `[model-registry] valid (${validated.models.length} models, ${validated.tombstones.length} tombstones)`
);
