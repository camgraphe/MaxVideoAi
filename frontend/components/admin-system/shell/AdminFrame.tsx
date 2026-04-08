import type { ReactNode } from 'react';

type AdminFrameProps = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
};

export function AdminFrame({ sidebar, topbar, children }: AdminFrameProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-bg">
      <div className="flex min-h-screen bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.04),transparent_28rem)] dark:bg-none">
        {sidebar}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-transparent">
          {topbar}
          <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-5">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
