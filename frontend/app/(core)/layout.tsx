import type { ReactNode } from 'react';
import { AppRuntime } from '@/app/_components/AppRuntime';

export { metadata, viewport } from '@/app/_lib/app-runtime-metadata';

export default function CoreLayout({ children }: { children: ReactNode }) {
  return <AppRuntime>{children}</AppRuntime>;
}
