'use client';

import { useLoginPageController } from '../_hooks/useLoginPageController';
import type { AuthMode, Locale } from '../_lib/login-copy';
import { LoginAuthSurface } from './LoginAuthSurface';

export function LoginPageClient({
  initialMode,
  initialLocale,
}: {
  initialMode: AuthMode;
  initialLocale: Locale;
}) {
  const controller = useLoginPageController({ initialMode, initialLocale });

  return <LoginAuthSurface {...controller} />;
}
