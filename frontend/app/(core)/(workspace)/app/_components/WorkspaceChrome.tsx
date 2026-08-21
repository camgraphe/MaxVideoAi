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
      <div className="flex flex-1 flex-col min-[1088px]:flex-row">
        <div className="flex min-w-0 flex-1">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <main className="flex min-w-0 flex-1 flex-col gap-[var(--stack-gap-lg)] p-4 lg:px-7 lg:py-2">
              {children}
            </main>
          </div>
        </div>
        <div className="border-t border-hairline bg-surface-glass-70 px-4 py-4 min-[1088px]:flex min-[1088px]:w-[320px] min-[1088px]:justify-end min-[1088px]:border-t-0 min-[1088px]:bg-transparent min-[1088px]:py-4 min-[1088px]:pl-2 min-[1088px]:pr-0">
          {rail}
        </div>
      </div>
    </div>
  );
}
