'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EngineCaps, Mode } from '@/types/engines';
import {
  persistImageSelection,
  persistVideoSelection,
  readStoredForm,
  readStoredImageForm,
} from '../_lib/dashboard-storage';
import { useDashboardExportsSummary } from './useDashboardExportsSummary';

const NEW_USER_ENGINE_ID = 'seedance-2-0';

export function useDashboardEngineSelection({
  videoEngines,
  imageEngines,
  authLoading,
  latestVideoEngineId,
  latestImageEngineId,
}: {
  videoEngines: EngineCaps[];
  imageEngines: EngineCaps[];
  authLoading: boolean;
  latestVideoEngineId?: string | null;
  latestImageEngineId?: string | null;
}) {
  const [selectedEngineId, setSelectedEngineId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<Mode>('t2v');
  const [hasStoredForm, setHasStoredForm] = useState(false);
  const [selectionResolved, setSelectionResolved] = useState(false);
  const [selectedImageEngineId, setSelectedImageEngineId] = useState<string | null>(null);
  const [selectedImageMode, setSelectedImageMode] = useState<Mode>('t2i');
  const [hasStoredImageForm, setHasStoredImageForm] = useState(false);
  const [imageSelectionResolved, setImageSelectionResolved] = useState(false);
  const exportsSummary = useDashboardExportsSummary({ authLoading, hasStoredForm });
  const exportsTotal = exportsSummary?.total;

  const availableEngines = useMemo(() => {
    return videoEngines.filter((engine) => isEngineAvailable(engine));
  }, [videoEngines]);

  const availableImageEngines = useMemo(() => {
    return imageEngines.filter((engine) => isEngineAvailable(engine) && supportsImageModes(engine));
  }, [imageEngines]);

  const engineLookupById = useMemo(() => {
    const byId = new Map<string, EngineCaps>();
    videoEngines.forEach((engine) => {
      byId.set(engine.id, engine);
    });
    return byId;
  }, [videoEngines]);

  const imageEngineLookupById = useMemo(() => {
    const byId = new Map<string, EngineCaps>();
    imageEngines.forEach((engine) => {
      byId.set(engine.id, engine);
    });
    return byId;
  }, [imageEngines]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = readStoredForm();
    if (stored?.engineId) {
      setSelectedEngineId(stored.engineId);
      setSelectedMode(stored.mode ?? 't2v');
      setHasStoredForm(true);
      setSelectionResolved(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = readStoredImageForm();
    if (stored?.engineId) {
      setSelectedImageEngineId(stored.engineId);
      setSelectedImageMode(stored.mode ?? 't2i');
      setHasStoredImageForm(true);
      setImageSelectionResolved(true);
    }
  }, []);

  useEffect(() => {
    if (selectionResolved || hasStoredForm || typeof exportsTotal !== 'number' || !availableEngines.length) return;
    if (exportsTotal === 0) {
      setSelectedEngineId(NEW_USER_ENGINE_ID);
      setSelectionResolved(true);
      return;
    }
    if (exportsTotal > 0) {
      const fallback = latestVideoEngineId ?? availableEngines[0]?.id ?? null;
      if (fallback) {
        setSelectedEngineId(fallback);
        setSelectionResolved(true);
      }
    }
  }, [availableEngines, exportsTotal, hasStoredForm, latestVideoEngineId, selectionResolved]);

  useEffect(() => {
    if (imageSelectionResolved || hasStoredImageForm || !availableImageEngines.length) return;
    if (typeof exportsTotal === 'number') {
      if (exportsTotal === 0) {
        setSelectedImageEngineId(availableImageEngines[0]?.id ?? null);
        setImageSelectionResolved(true);
        return;
      }
      if (exportsTotal > 0) {
        const fallback = latestImageEngineId ?? availableImageEngines[0]?.id ?? null;
        if (fallback) {
          setSelectedImageEngineId(fallback);
          setImageSelectionResolved(true);
        }
        return;
      }
    }
    const fallback = latestImageEngineId ?? availableImageEngines[0]?.id ?? null;
    if (fallback) {
      setSelectedImageEngineId(fallback);
      setImageSelectionResolved(true);
    }
  }, [
    availableImageEngines,
    exportsTotal,
    hasStoredImageForm,
    imageSelectionResolved,
    latestImageEngineId,
  ]);

  useEffect(() => {
    if (!availableEngines.length || !selectedEngineId) return;
    const isAvailable = availableEngines.some((engine) => engine.id === selectedEngineId);
    if (!isAvailable) {
      setSelectedEngineId(availableEngines[0]?.id ?? selectedEngineId);
    }
  }, [availableEngines, selectedEngineId]);

  useEffect(() => {
    if (!availableImageEngines.length || !selectedImageEngineId) return;
    const isAvailable = availableImageEngines.some((engine) => engine.id === selectedImageEngineId);
    if (!isAvailable) {
      setSelectedImageEngineId(availableImageEngines[0]?.id ?? selectedImageEngineId);
    }
  }, [availableImageEngines, selectedImageEngineId]);

  const selectedEngine = useMemo(() => {
    if (!selectedEngineId) return availableEngines[0] ?? videoEngines[0] ?? null;
    return engineLookupById.get(selectedEngineId) ?? availableEngines[0] ?? videoEngines[0] ?? null;
  }, [availableEngines, engineLookupById, selectedEngineId, videoEngines]);

  const selectedImageEngine = useMemo(() => {
    if (!selectedImageEngineId) return availableImageEngines[0] ?? imageEngines[0] ?? null;
    return imageEngineLookupById.get(selectedImageEngineId) ?? availableImageEngines[0] ?? imageEngines[0] ?? null;
  }, [availableImageEngines, imageEngineLookupById, imageEngines, selectedImageEngineId]);

  useEffect(() => {
    if (!selectedEngine) return;
    if (!selectedEngine.modes.includes(selectedMode)) {
      setSelectedMode(selectedEngine.modes[0] ?? 't2v');
    }
  }, [selectedEngine, selectedMode]);

  useEffect(() => {
    if (!selectedImageEngine) return;
    if (!selectedImageEngine.modes.includes(selectedImageMode)) {
      const fallbackMode =
        selectedImageEngine.modes.find((mode) => mode === 't2i' || mode === 'i2i') ?? 't2i';
      setSelectedImageMode(fallbackMode);
    }
  }, [selectedImageEngine, selectedImageMode]);

  const handleVideoModeChange = useCallback((mode: Mode) => {
    setSelectedMode(mode);
  }, []);

  const handleVideoEngineChange = useCallback((engineId: string) => {
    setSelectedEngineId(engineId);
    setSelectionResolved(true);
  }, []);

  const handleImageModeChange = useCallback((mode: Mode) => {
    setSelectedImageMode(mode);
  }, []);

  const handleImageEngineChange = useCallback((engineId: string) => {
    setSelectedImageEngineId(engineId);
    setImageSelectionResolved(true);
  }, []);

  const resolveVideoStart = useCallback(() => {
    if (!selectedEngine) return null;
    const nextMode = selectedEngine.modes.includes(selectedMode)
      ? selectedMode
      : selectedEngine.modes[0] ?? 't2v';
    persistVideoSelection(selectedEngine.id, nextMode);
    return { engineId: selectedEngine.id, mode: nextMode };
  }, [selectedEngine, selectedMode]);

  const resolveImageStart = useCallback(() => {
    if (!selectedImageEngine) return null;
    const nextMode = selectedImageEngine.modes.includes(selectedImageMode)
      ? selectedImageMode
      : selectedImageEngine.modes.find((mode) => mode === 't2i' || mode === 'i2i') ?? 't2i';
    persistImageSelection(selectedImageEngine.id, nextMode);
    return { engineId: selectedImageEngine.id, mode: nextMode };
  }, [selectedImageEngine, selectedImageMode]);

  return {
    availableEngines,
    availableImageEngines,
    selectedEngine,
    selectedMode,
    selectedImageEngine,
    selectedImageMode,
    hasStoredForm,
    hasStoredImageForm,
    canStart: Boolean(selectedEngine),
    canStartImage: Boolean(selectedImageEngine),
    engineLookupById,
    handleVideoModeChange,
    handleVideoEngineChange,
    handleImageModeChange,
    handleImageEngineChange,
    resolveVideoStart,
    resolveImageStart,
  };
}

function isEngineAvailable(engine: EngineCaps): boolean {
  const availability = engine.availability ?? 'available';
  return availability !== 'paused';
}

function supportsImageModes(engine: EngineCaps): boolean {
  return engine.modes.some((mode) => mode === 't2i' || mode === 'i2i');
}
