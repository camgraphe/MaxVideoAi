'use client';

import { useEffect, useState } from 'react';

export function useExamplesGalleryColumns() {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const twoColumns = window.matchMedia('(max-width: 1279px)');
    const oneColumn = window.matchMedia('(max-width: 767px)');

    const update = () => {
      if (oneColumn.matches) {
        setCount(1);
      } else if (twoColumns.matches) {
        setCount(2);
      } else {
        setCount(3);
      }
    };

    update();
    const unsubscribers = [twoColumns, oneColumn].map((query) => {
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
      }
      query.addListener(update);
      return () => query.removeListener(update);
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  return count;
}
