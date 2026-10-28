import type { ReactNode } from 'react';
import { AppNavigation } from './AppNavigation.client';
import { PROMPT_ASSISTANCE_PREVIEW } from '@/lib/prompt-assistance/preview-state';

export function AppCreationContent({ children, railNavigation }: { children: ReactNode; railNavigation?: ReactNode }) {
  return (
    <div className="app-creation-content flex min-w-0 flex-1 flex-col">
      {PROMPT_ASSISTANCE_PREVIEW ? <div className="app-creation-topbar">
        <div className="app-creation-topbar-main"><AppNavigation variant="activities" /></div>
        {railNavigation ? <div className="app-creation-topbar-rail">{railNavigation}</div> : null}
      </div> : <AppNavigation variant="activities" />}
      {children}
    </div>
  );
}
