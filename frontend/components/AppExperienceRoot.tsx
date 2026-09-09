'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { isAppExperiencePath } from '@/lib/app-experience-path';

export function AppExperienceRoot({ children, fontClass }: { children: ReactNode; fontClass: string }) {
  const pathname = usePathname() ?? '';
  const isApp = isAppExperiencePath(pathname);
  return <div className={`${fontClass}${isApp ? ' app-experience' : ''}`}>{children}</div>;
}
