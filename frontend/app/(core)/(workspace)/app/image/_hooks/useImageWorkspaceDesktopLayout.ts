import { useEffect, useState } from 'react';
import { DESKTOP_RAIL_MIN_WIDTH } from '../_lib/image-workspace-types';

export function useImageWorkspaceDesktopLayout(): boolean {
  const [isDesktopLayout, setIsDesktopLayout] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia(`(min-width: ${DESKTOP_RAIL_MIN_WIDTH}px)`);
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktopLayout(event.matches);
    };
    handleChange(mediaQuery);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return isDesktopLayout;
}
