import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import clsx from 'clsx';

type AdminFilterBarProps = Omit<ComponentPropsWithoutRef<'form'>, 'children'> & {
  children: ReactNode;
  helper?: ReactNode;
  actions?: ReactNode;
  fieldsClassName?: string;
};

export function AdminFilterBar({
  children,
  helper,
  actions,
  className,
  fieldsClassName,
  ...props
}: AdminFilterBarProps) {
  return (
    <form className={clsx('border-b border-hairline py-3', className)} {...props}>
      <div className={clsx('grid gap-3', fieldsClassName)}>{children}</div>
      {helper || actions ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 text-sm text-text-secondary">{helper}</div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
    </form>
  );
}
