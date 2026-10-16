import type { ReactNode } from 'react';
import { AppRuntime } from '@/app/_components/AppRuntime';
import { MARKETING_CLIENT_MESSAGE_NAMESPACES } from '@/lib/i18n/client-message-namespaces';

export { metadata, viewport } from '@/app/_lib/app-runtime-metadata';

export default function PublicWatchLayout({ children }: { children: ReactNode }) {
  return <AppRuntime clientMessageNamespaces={MARKETING_CLIENT_MESSAGE_NAMESPACES}>{children}</AppRuntime>;
}
