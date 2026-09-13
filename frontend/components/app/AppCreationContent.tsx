import type { ReactNode } from 'react';
import { AppNavigation } from './AppNavigation.client';

export function AppCreationContent({ children }: { children: ReactNode }) {
  return (
    <div className="app-creation-content flex min-w-0 flex-1 flex-col">
      <AppNavigation variant="activities" />
      {children}
    </div>
  );
}
