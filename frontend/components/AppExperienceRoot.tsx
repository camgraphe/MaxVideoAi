'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

const APP_PATHS = ['/app', '/dashboard', '/settings', '/jobs', '/billing', '/account/connections'];

export function AppExperienceRoot({ children, fontClass }: { children: ReactNode; fontClass: string }) {
  const pathname = usePathname() ?? '';
  const isApp = APP_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  return <div className={`${fontClass}${isApp ? ' app-experience' : ''}`}>{children}</div>;
}
