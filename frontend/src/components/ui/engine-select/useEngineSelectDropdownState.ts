import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction,
} from 'react';
import type { EngineCaps } from '@/types/engines';
import type { DropdownPosition } from './engine-select-types';

type UseEngineSelectDropdownStateArgs = {
  onEngineChange: (engineId: string) => void;
  open: boolean;
  selectedEngineId?: string;
  setOpen: Dispatch<SetStateAction<boolean>>;
  visibleEngines: EngineCaps[];
};

export function useEngineSelectDropdownState({
  onEngineChange,
  open,
  selectedEngineId,
  setOpen,
  visibleEngines,
}: UseEngineSelectDropdownStateArgs) {
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [portalElement, setPortalElement] = useState<HTMLDivElement | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  const toggleOpen = () => {
    setOpen((previous) => {
      const next = !previous;
      if (next) {
        updatePosition();
      } else {
        setHighlightedIndex(-1);
      }
      return next;
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();

    function handleResize() {
      updatePosition();
    }

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('scroll', handleResize, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    if (!visibleEngines.length) {
      setHighlightedIndex(-1);
      return;
    }
    const currentIndex = visibleEngines.findIndex((candidate) => candidate.id === selectedEngineId);
    setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
  }, [open, visibleEngines, selectedEngineId]);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (contentRef.current?.contains(target)) return;
      setOpen(false);
      setHighlightedIndex(-1);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        setHighlightedIndex(-1);
        triggerRef.current?.focus();
        return;
      }

      if (!visibleEngines.length) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((previous) => (previous + 1 >= visibleEngines.length ? 0 : previous + 1));
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((previous) => (previous - 1 < 0 ? visibleEngines.length - 1 : previous - 1));
      }

      if (event.key === 'Enter' || event.key === ' ') {
        if (highlightedIndex >= 0 && highlightedIndex < visibleEngines.length) {
          event.preventDefault();
          onEngineChange(visibleEngines[highlightedIndex].id);
          setOpen(false);
          setHighlightedIndex(-1);
          triggerRef.current?.focus();
        }
      }
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer, { passive: true });
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [highlightedIndex, onEngineChange, open, setOpen, visibleEngines]);

  useEffect(() => {
    if (!open) return;
    const item = itemRefs.current[highlightedIndex];
    item?.focus({ preventScroll: true });
    item?.scrollIntoView({ block: 'nearest' });
  }, [open, highlightedIndex]);

  useEffect(() => {
    const element = document.createElement('div');
    element.dataset.engineSelectPortal = 'true';
    document.body.appendChild(element);
    setPortalElement(element);
    return () => {
      try {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      } catch {}
    };
  }, []);

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        updatePosition();
      }
      setOpen(true);
    }
  };

  return {
    containerRef,
    contentRef,
    handleTriggerKeyDown,
    highlightedIndex,
    itemRefs,
    portalElement,
    position,
    setHighlightedIndex,
    toggleOpen,
    triggerRef,
  };
}
