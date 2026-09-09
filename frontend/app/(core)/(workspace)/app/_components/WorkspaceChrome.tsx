import type { ReactNode } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';

type WorkspaceChromeProps = {
  children: ReactNode;
  rail: ReactNode;
};

export function WorkspaceChrome({
  children,
  rail,
}: WorkspaceChromeProps) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-none flex-col min-[768px]:flex-1 min-[768px]:flex-row">
        <div className="flex min-w-0 flex-none min-[768px]:flex-1">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <main className="app-workspace-main flex min-w-0 flex-none flex-col gap-[var(--stack-gap-lg)] p-4 min-[768px]:flex-1 lg:px-7 lg:py-2">
              {children}
            </main>
          </div>
        </div>
        <div className="app-results-rail border-t border-hairline bg-surface-glass-70 px-4 py-4 min-[768px]:flex min-[768px]:w-[240px] min-[768px]:justify-end min-[768px]:border-t-0 min-[768px]:bg-transparent min-[768px]:py-4 min-[768px]:pl-2 min-[768px]:pr-0 min-[900px]:w-[272px] min-[1088px]:w-[320px]">
          {rail}
        </div>
      </div>
    </div>
  );
}
