import {
  materializeFalEngineEntry,
} from '../../frontend/src/config/fal-engine-materialization';
import { UNPUBLISHED_FAL_ENGINE_REGISTRY } from '../../frontend/src/config/fal-engines/registry';
import type { FalEngineEntry } from '../../frontend/src/config/fal-engines/types';

/**
 * Private engine contracts stay out of the application-facing Fal registry.
 * The build catalog still projects them so registry validation can retain one
 * canonical engine row for every active identity.
 */
export function listBuildOnlyPrivateFalEngines(): FalEngineEntry[] {
  return UNPUBLISHED_FAL_ENGINE_REGISTRY.map(materializeFalEngineEntry);
}
