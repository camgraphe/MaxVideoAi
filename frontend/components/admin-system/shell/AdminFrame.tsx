import type { ReactNode } from 'react';

type AdminFrameProps = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
};

export function AdminFrame({ sidebar, topbar, children }: AdminFrameProps) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="flex min-h-screen bg-[linear-gradient(180deg,rgba(15,23,42,0.02),transparent_200px)]">
        {sidebar}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          {topbar}
          <main className="flex-1 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
