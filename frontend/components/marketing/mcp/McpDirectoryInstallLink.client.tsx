'use client';

import type { ReactNode } from 'react';
import type { AppLocale } from '@/i18n/locales';
import { useMcpConnectNavigation } from './useMcpConnectNavigation';

export function McpDirectoryInstallLink({ children, className, client, href, locale }: {
  children: ReactNode;
  className?: string;
  client: 'chatgpt' | 'codex';
  href: string;
  locale: AppLocale;
}) {
  const onConnect = useMcpConnectNavigation(locale);
  return (
    <a className={className} href={href} onClick={onConnect(client, 'verified_deep_link')}>
      {children}
    </a>
  );
}
