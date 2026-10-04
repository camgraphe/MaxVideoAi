import type { ReactNode } from 'react';

type AdminPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function AdminPageHeader({ eyebrow = 'Admin', title, description, actions }: AdminPageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0 max-w-3xl">
        <span className="sr-only">{eyebrow}</span>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 xl:justify-end">{actions}</div> : null}
    </header>
  );
}
