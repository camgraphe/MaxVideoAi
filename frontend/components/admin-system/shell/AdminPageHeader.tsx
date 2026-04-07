import type { ReactNode } from 'react';

type AdminPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function AdminPageHeader({
  eyebrow = 'Admin',
  title,
  description,
  actions,
}: AdminPageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-text-primary">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
