'use client';

import { Button, ButtonLink } from '@/components/ui/Button';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import type { ImageWorkspaceCopy } from '../_lib/image-workspace-copy';
import { buildLoginHref } from '@/lib/auth-entry-href';

type ImageAuthGateModalProps = {
  open: boolean;
  copy: ImageWorkspaceCopy['authGate'];
  loginRedirectTarget: string;
  onClose: () => void;
};

export function ImageAuthGateModal(props: ImageAuthGateModalProps) {
  if (!props.open) return null;
  return <ImageAuthGateDialog {...props} />;
}

function ImageAuthGateDialog({
  copy,
  loginRedirectTarget,
  onClose,
}: Omit<ImageAuthGateModalProps, 'open'>) {
  const { dialogRef, onDialogKeyDown } = useAccessibleModal<HTMLDivElement>({ onClose });

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6">
      <div className="absolute inset-0" role="presentation" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-auth-gate-title"
        aria-describedby="image-auth-gate-description"
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 id="image-auth-gate-title" className="text-base font-semibold text-text-primary">
              {copy.title}
            </h2>
            <p id="image-auth-gate-description" className="mt-2 text-sm text-text-secondary">
              {copy.body}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-full border-hairline bg-surface-glass-80 px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
            aria-label={copy.close}
          >
            {copy.close}
          </Button>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <ButtonLink
            href={buildLoginHref({ mode: 'signup', nextPath: loginRedirectTarget })}
            size="sm"
            className="px-4"
            data-modal-initial-focus="true"
          >
            {copy.primary}
          </ButtonLink>
          <ButtonLink
            href={buildLoginHref({ mode: 'signin', nextPath: loginRedirectTarget })}
            variant="outline"
            size="sm"
            className="px-4"
          >
            {copy.secondary}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
