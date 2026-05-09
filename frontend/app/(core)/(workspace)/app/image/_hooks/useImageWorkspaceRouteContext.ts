import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { FEATURES } from '@/content/feature-flags';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  DEFAULT_COPY,
  mergeCopy,
  type ImageWorkspaceCopy,
} from '../_lib/image-workspace-copy';

export function useImageWorkspaceRouteContext() {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawCopy = t('workspace.image', DEFAULT_COPY);
  const resolvedCopy = useMemo<ImageWorkspaceCopy>(() => {
    return mergeCopy(DEFAULT_COPY, (rawCopy ?? {}) as Partial<ImageWorkspaceCopy>);
  }, [rawCopy]);
  const advancedSettingsTitle = t('workspace.generate.controls.advancedTitle', 'Advanced settings') as string;
  const loginRedirectTarget = useMemo(() => {
    const params = searchParams?.toString() ?? '';
    const base = pathname ?? '/app/image';
    return params ? `${base}?${params}` : base;
  }, [pathname, searchParams]);

  return {
    advancedSettingsTitle,
    loginRedirectTarget,
    resolvedCopy,
    searchParams,
    toolsEnabled: FEATURES.workflows.toolsSection,
  };
}
