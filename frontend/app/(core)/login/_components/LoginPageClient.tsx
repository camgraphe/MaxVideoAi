'use client';

import { useLoginPageController } from '../_hooks/useLoginPageController';
import type { AuthMode, Locale } from '../_lib/login-copy';
import { LoginAuthSurface } from './LoginAuthSurface';

export function LoginPageClient({
  initialMode,
  initialLocale,
  initialMcpConnection,
  isMcpStaging,
}: {
  initialMode: AuthMode;
  initialLocale: Locale;
  initialMcpConnection: boolean;
  isMcpStaging: boolean;
}) {
  const controller = useLoginPageController({ initialMode, initialLocale, initialMcpConnection });

  return <LoginAuthSurface {...controller} isMcpStaging={isMcpStaging} />;
}
