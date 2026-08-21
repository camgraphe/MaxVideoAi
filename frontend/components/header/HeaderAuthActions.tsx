'use client';

import { useRouter } from 'next/navigation';
import { ButtonLink } from '@/components/ui/Button';

type HeaderTranslate = (key: string, fallback: string) => string | undefined;

type HeaderAuthActionsProps = {
  createAccountMobile: string;
  signInMobile: string;
  signinHref: string;
  signupHref: string;
  t: HeaderTranslate;
};

export function HeaderAuthActions({
  createAccountMobile,
  signInMobile,
  signinHref,
  signupHref,
  t,
}: HeaderAuthActionsProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <ButtonLink
        href={signupHref}
        prefetch={false}
        size="sm"
        onMouseEnter={() => router.prefetch(signupHref)}
        onFocus={() => router.prefetch(signupHref)}
        className="h-9 px-2.5 text-[11px] shadow-card sm:h-10 sm:px-3 sm:text-sm"
      >
        <span className="sm:hidden">{createAccountMobile}</span>
        <span className="hidden sm:inline">{t('workspace.header.createAccount', 'Create account')}</span>
      </ButtonLink>
      <ButtonLink
        href={signinHref}
        prefetch={false}
        variant="outline"
        size="sm"
        onMouseEnter={() => router.prefetch(signinHref)}
        onFocus={() => router.prefetch(signinHref)}
        className="h-9 px-2.5 text-[11px] sm:h-10 sm:px-3 sm:text-sm"
      >
        <span className="sm:hidden">{signInMobile}</span>
        <span className="hidden sm:inline">{t('workspace.header.signIn', 'Sign in')}</span>
      </ButtonLink>
    </div>
  );
}
