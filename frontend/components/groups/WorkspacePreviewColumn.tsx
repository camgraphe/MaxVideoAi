import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';

const WORKSPACE_PREVIEW_WIDTH_STYLE: CSSProperties = {
  width: 'min(100%,max(1.778px,var(--workspace-preview-fluid-width)),583.111px)',
};

export function WorkspacePreviewColumn({
  children,
  constrained = true,
}: {
  children: ReactNode;
  constrained?: boolean;
}) {
  return (
    <div
      data-workspace-preview-column={constrained || undefined}
      className={clsx(
        'mx-auto flex flex-col items-center',
        constrained
          ? '[--workspace-preview-fluid-width:calc(44.444444svh_-_21.333333px)] sm:[--workspace-preview-fluid-width:calc(56.888889svh_-_21.333333px)]'
          : 'w-full'
      )}
      style={constrained ? WORKSPACE_PREVIEW_WIDTH_STYLE : undefined}
    >
      {children}
    </div>
  );
}
