import { useEffect, useMemo, useState } from 'react';
import type { EngineCaps } from '@/types/engines';
import {
  compareEnginesByDefaultPriority,
  ENGINE_LEGACY_STORAGE_KEY,
  ensureEngineRegistryMeta,
  getCachedEngineRegistryMeta,
} from './engine-select-helpers';
import type { EngineRegistryMeta } from './engine-select-types';

type UseEngineSelectRegistryArgs = {
  browseOpen: boolean;
  engineId: string;
  engines: EngineCaps[];
  open: boolean;
};

export function useEngineSelectRegistry({
  browseOpen,
  engineId,
  engines,
  open,
}: UseEngineSelectRegistryArgs) {
  const [registryMeta, setRegistryMeta] = useState<EngineRegistryMeta | null>(() => getCachedEngineRegistryMeta());
  const [showLegacy, setShowLegacy] = useState(false);
  const [legacyHydrated, setLegacyHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(ENGINE_LEGACY_STORAGE_KEY);
      if (stored === 'true') {
        setShowLegacy(true);
      }
    } catch {
      // ignore storage failures
    } finally {
      setLegacyHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!legacyHydrated) return;
    try {
      window.localStorage.setItem(ENGINE_LEGACY_STORAGE_KEY, showLegacy ? 'true' : 'false');
    } catch {
      // ignore storage failures
    }
  }, [legacyHydrated, showLegacy]);

  const availableEngines = useMemo(() => {
    const sorted = engines.slice();
    sorted.sort((a, b) => compareEnginesByDefaultPriority(a, b, registryMeta));
    return sorted.filter((entry) => entry.availability !== 'paused');
  }, [engines, registryMeta]);

  const selectedEngine = useMemo(() => {
    const candidate = availableEngines.find((entry) => entry.id === engineId);
    return candidate ?? availableEngines[0] ?? engines[0];
  }, [availableEngines, engineId, engines]);

  const selectedMeta = useMemo(
    () => (selectedEngine ? registryMeta?.meta.get(selectedEngine.id) : undefined),
    [registryMeta, selectedEngine]
  );

  const visibleEngines = useMemo(() => {
    return availableEngines.filter((engine) => {
      const meta = registryMeta?.meta.get(engine.id);
      if (!meta?.isLegacy) return true;
      if (showLegacy) return true;
      return engine.id === selectedEngine?.id;
    });
  }, [availableEngines, registryMeta, selectedEngine, showLegacy]);

  const hasLegacyEngines = useMemo(
    () => availableEngines.some((engine) => Boolean(registryMeta?.meta.get(engine.id)?.isLegacy)),
    [availableEngines, registryMeta]
  );

  const variantEngines = useMemo(() => {
    if (!selectedEngine) return [];
    const selectedVariantGroup = selectedMeta?.surfaces.app.variantGroup;
    if (selectedVariantGroup) {
      return availableEngines.filter(
        (entry) => registryMeta?.meta.get(entry.id)?.surfaces.app.variantGroup === selectedVariantGroup
      );
    }
    return [];
  }, [availableEngines, registryMeta, selectedEngine, selectedMeta]);

  useEffect(() => {
    if (registryMeta) return;
    if (typeof window === 'undefined') return;
    let active = true;
    const timer = window.setTimeout(() => {
      ensureEngineRegistryMeta()
        .then((meta) => {
          if (active) setRegistryMeta(meta);
        })
        .catch(() => undefined);
    }, 1200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [registryMeta]);

  useEffect(() => {
    if (registryMeta) return;
    if (!open && !browseOpen) return;
    let active = true;
    ensureEngineRegistryMeta()
      .then((meta) => {
        if (active) setRegistryMeta(meta);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [browseOpen, open, registryMeta]);

  return {
    availableEngines,
    hasLegacyEngines,
    registryMeta,
    selectedEngine,
    selectedMeta,
    setShowLegacy,
    showLegacy,
    showVariantSelector: variantEngines.length > 1,
    variantEngines,
    visibleEngines,
  };
}
