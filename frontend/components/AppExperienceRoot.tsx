'use client';

import { useEffect, type ReactNode } from 'react';
import { applyResolvedTheme, readThemeSnapshot, subscribeToThemePreference } from '@/hooks/useThemePreference';
import { usePathname } from 'next/navigation';
import { isAppExperiencePath } from '@/lib/app-experience-path';

export function AppExperienceRoot({ children, fontClass }: { children: ReactNode; fontClass: string }) {
  const pathname = usePathname() ?? '';
  const isApp = isAppExperiencePath(pathname);
  useEffect(() => {
    if (!isApp) return;
    const sync = () => applyResolvedTheme(readThemeSnapshot(window).resolvedTheme);
    sync();
    return subscribeToThemePreference(window, sync);
  }, [isApp]);
  return <div className={`${fontClass}${isApp ? ' app-experience' : ''}`}>{children}</div>;
}
