'use client';

import { useCallback, useId, useSyncExternalStore } from 'react';

let activePickerId: string | null = null;
const pickerListeners = new Set<() => void>();

const subscribePicker = (listener: () => void) => {
  pickerListeners.add(listener);
  return () => {
    pickerListeners.delete(listener);
  };
};

const getActivePickerId = () => activePickerId;
const getServerActivePickerId = () => null;

const setActivePickerId = (nextPickerId: string | null) => {
  if (activePickerId === nextPickerId) return;
  activePickerId = nextPickerId;
  pickerListeners.forEach((listener) => listener());
};

export function useExclusiveMediaPicker() {
  const mediaPickerId = useId();
  const activeId = useSyncExternalStore(subscribePicker, getActivePickerId, getServerActivePickerId);
  const pickerOpen = activeId === mediaPickerId;

  const closePicker = useCallback(() => {
    if (activePickerId === mediaPickerId) {
      setActivePickerId(null);
    }
  }, [mediaPickerId]);

  const openPicker = useCallback(() => {
    setActivePickerId(mediaPickerId);
  }, [mediaPickerId]);

  return { closePicker, mediaPickerId, openPicker, pickerOpen };
}
