import clsx from 'clsx';
import type { ReactNode } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';

type WorkspaceChromeProps = {
  isDesktopLayout: boolean;
  children: ReactNode;
  desktopRail: ReactNode;
  mobileRail: ReactNode;
};

export function WorkspaceChrome({
  isDesktopLayout,
  children,
  desktopRail,
  mobileRail,
}: WorkspaceChromeProps) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className={clsx('flex flex-1', isDesktopLayout ? 'flex-row' : 'flex-col')}>
        <div className="flex min-w-0 flex-1">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <main className="flex min-w-0 flex-1 flex-col gap-[var(--stack-gap-lg)] p-5 lg:p-7">
              {children}
            </main>
          </div>
        </div>
        {isDesktopLayout ? (
          <div className="flex w-[320px] justify-end py-4 pl-2 pr-0">
            {desktopRail}
          </div>
        ) : null}
      </div>
      {!isDesktopLayout ? (
        <div className="border-t border-hairline bg-surface-glass-70 px-4 py-4">
          {mobileRail}
        </div>
      ) : null}
    </div>
  );
}
