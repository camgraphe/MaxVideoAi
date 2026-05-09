import { useMemo } from 'react';
import type { ImageEngineOption } from '../_lib/image-workspace-types';

export function useImageWorkspaceSelectedEngine(engines: ImageEngineOption[], engineId: string) {
  const engineCapsList = useMemo(() => engines.map((engine) => engine.engineCaps), [engines]);
  const selectedEngine = useMemo(
    () => engines.find((engine) => engine.id === engineId) ?? engines[0],
    [engineId, engines]
  );
  const autoModeFromReferences = Boolean(
    selectedEngine && selectedEngine.modes.includes('t2i') && selectedEngine.modes.includes('i2i')
  );
  const selectedEngineCaps = selectedEngine?.engineCaps ?? engines[0]?.engineCaps;

  return {
    autoModeFromReferences,
    engineCapsList,
    selectedEngine,
    selectedEngineCaps,
  };
}
