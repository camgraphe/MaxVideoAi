'use client';

import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

const SWR_CONFIG = {
  revalidateOnFocus: true,
  focusThrottleInterval: 5000,
};

export function SWRProvider({ children }: { children: ReactNode }) {
  return <SWRConfig value={SWR_CONFIG}>{children}</SWRConfig>;
}
