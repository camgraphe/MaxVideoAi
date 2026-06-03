'use client';

import { useCallback, useMemo } from 'react';
import { DEFAULT_PROCESSING_COPY } from '@/components/groups/ProcessingOverlay';
import { useResultProvider } from '@/hooks/useResultProvider';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { ENV as CLIENT_ENV } from '@/lib/env';
import { useEngines, useInfiniteJobs } from '@/lib/api';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  getLocalizedWorkflowCopy,
  normalizeUiLocale,
} from '@/lib/ltx-localization';
import type { EngineCaps } from '@/types/engines';
import {
  DEFAULT_WORKSPACE_COPY,
  mergeCopy,
} from '../_lib/workspace-copy';

export function useWorkspaceAppBootstrap() {
  const { data, error: enginesError, isLoading } = useEngines();
  const engines = useMemo(() => data?.engines ?? [], [data]);
  const { data: latestJobsPages, mutate: mutateLatestJobs } = useInfiniteJobs(24, { type: 'video' });
  const { user, loading: authLoading, authStatus } = useRequireAuth({ redirectIfLoggedOut: false });
  const provider = useResultProvider();
  const showCenterGallery = CLIENT_ENV.WORKSPACE_CENTER_GALLERY === 'true';
  const { t, locale } = useI18n();
  const uiLocale = normalizeUiLocale(locale);
  const workflowCopy = useMemo(() => getLocalizedWorkflowCopy(uiLocale), [uiLocale]);
  const rawWorkspaceCopy = t('workspace.generate', DEFAULT_WORKSPACE_COPY);
  const workspaceCopy = useMemo(
    () =>
      mergeCopy(
        DEFAULT_WORKSPACE_COPY,
        (rawWorkspaceCopy ?? {}) as Partial<typeof DEFAULT_WORKSPACE_COPY>
      ),
    [rawWorkspaceCopy]
  );
  const processingCopy = (t('workspace.generate.processing', DEFAULT_PROCESSING_COPY) ??
    DEFAULT_PROCESSING_COPY) as typeof DEFAULT_PROCESSING_COPY;

  const engineIdByLabel = useMemo(() => {
    const map = new Map<string, string>();
    engines.forEach((engine) => {
      map.set(engine.label.toLowerCase(), engine.id);
    });
    return map;
  }, [engines]);
  const engineMap = useMemo(() => {
    const map = new Map<string, EngineCaps>();
    engines.forEach((entry) => {
      map.set(entry.id, entry);
    });
    return map;
  }, [engines]);
  const recentJobs = useMemo(
    () =>
      (latestJobsPages?.flatMap((page) => page.jobs ?? []) ?? []).filter(
        (job) =>
          job.surface !== 'audio' &&
          job.surface !== 'image' &&
          job.surface !== 'storyboard' &&
          job.surface !== 'character' &&
          job.surface !== 'angle' &&
          job.surface !== 'upscale'
      ),
    [latestJobsPages]
  );
  const formatTakeLabel = useCallback(
    (current: number, total: number) => {
      if (total <= 1) return '';
      const template = processingCopy.takeLabel ?? DEFAULT_PROCESSING_COPY.takeLabel;
      if (!template) return '';
      return template.replace('{current}', `${current}`).replace('{total}', `${total}`);
    },
    [processingCopy.takeLabel]
  );

  return {
    authLoading,
    authStatus,
    engineIdByLabel,
    engineMap,
    engines,
    enginesError,
    formatTakeLabel,
    isLoading,
    mutateLatestJobs,
    provider,
    recentJobs,
    showCenterGallery,
    uiLocale,
    user,
    workflowCopy,
    workspaceCopy,
  };
}
