'use client';

import { useLayoutEffect, type ReactNode } from 'react';
import { applyResolvedTheme, readThemeSnapshot, subscribeToThemePreference } from '@/hooks/useThemePreference';
import { usePathname } from 'next/navigation';
import { isAppExperiencePath } from '@/lib/app-experience-path';

export function AppExperienceRoot({ children, fontClass }: { children: ReactNode; fontClass: string }) {
  const pathname = usePathname() ?? '';
  const isApp = isAppExperiencePath(pathname);
  useLayoutEffect(() => {
    if (!isApp) {
      applyResolvedTheme('light');
      return;
    }
    const sync = () => applyResolvedTheme(readThemeSnapshot(window).resolvedTheme);
    sync();
    const unsubscribe = subscribeToThemePreference(window, sync);
    return () => {
      unsubscribe();
      applyResolvedTheme('light');
    };
  }, [isApp]);
  return <div className={`${fontClass}${isApp ? ' app-experience' : ''}`}>{children}</div>;
}
