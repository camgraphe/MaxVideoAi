import { Button, ButtonLink } from '@/components/ui/Button';
import { buildLoginHref } from '@/lib/auth-entry-href';
import type { StoryboardCopy } from '../_lib/storyboard-workspace-copy';

export function StoryboardAuthModal({ copy, onClose }: { copy: StoryboardCopy; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0" role="presentation" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">{copy.authTitle}</h2>
            <p className="mt-2 text-sm text-text-secondary">{copy.authBody}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose} aria-label={copy.close}>
            {copy.close}
          </Button>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <ButtonLink
            href={buildLoginHref({ mode: 'signup', nextPath: '/app/tools/storyboard' })}
            size="sm"
          >
            {copy.authPrimary}
          </ButtonLink>
          <ButtonLink
            href={buildLoginHref({ mode: 'signin', nextPath: '/app/tools/storyboard' })}
            variant="outline"
            size="sm"
          >
            {copy.authSecondary}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
