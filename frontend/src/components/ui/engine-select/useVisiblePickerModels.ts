'use client';
import { useEffect, useState, type RefObject } from 'react';

/** Closed families never mount rows; only intersecting mounted rows request estimates. */
export function useVisiblePickerModels(root: RefObject<HTMLDivElement | null>, renderedIds: string[]) {
  const key = renderedIds.join('|');
  const [visible, setVisible] = useState<{ key: string; ids: string[] }>({ key: '', ids: [] });
  useEffect(() => {
    const ids = key ? key.split('|') : [];
    const container = root.current;
    if (!container) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible({ key, ids }); return; }
    const intersecting = new Set<string>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const id = entry.target.getAttribute('data-model-id');
        if (id) { if (entry.isIntersecting) intersecting.add(id); else intersecting.delete(id); }
      }
      setVisible({ key, ids: ids.filter(id => intersecting.has(id)) });
    }, { root: container, threshold: 0 });
    container.querySelectorAll('[data-model-id]').forEach(row => observer.observe(row));
    return () => observer.disconnect();
  }, [key, root]);
  return visible.key === key ? visible.ids : [];
}
