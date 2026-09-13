'use client';

import { AppNavigation } from '@/components/app/AppNavigation.client';

export function WorkspaceMobileNav({ studioVisible = false }: { studioVisible?: boolean }) {
  return <AppNavigation variant="mobile" studioVisible={studioVisible} />;
}
