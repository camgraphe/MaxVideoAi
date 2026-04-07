import type { ReactNode } from 'react';
import clsx from 'clsx';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';

type AdminInspectorPanelProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  sticky?: boolean;
  className?: string;
  sectionClassName?: string;
  contentClassName?: string;
};

export function AdminInspectorPanel({
  title,
  description,
  action,
  children,
  sticky = true,
  className,
  sectionClassName,
  contentClassName,
}: AdminInspectorPanelProps) {
  return (
    <div className={clsx(sticky && 'xl:sticky xl:top-[5.75rem]', className)}>
      <AdminSection
        title={title}
        description={description}
        action={action}
        className={sectionClassName}
        contentClassName={contentClassName}
      >
        {children}
      </AdminSection>
    </div>
  );
}
