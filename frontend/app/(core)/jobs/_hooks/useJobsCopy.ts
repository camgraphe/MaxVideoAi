'use client';

import { useMemo } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { DEFAULT_JOBS_COPY, type JobsCopy } from '../_lib/jobs-copy';

export function useJobsCopy(): JobsCopy {
  const { t } = useI18n();
  const rawCopy = t('workspace.jobs', DEFAULT_JOBS_COPY);

  return useMemo(() => {
    if (!rawCopy || typeof rawCopy !== 'object') return DEFAULT_JOBS_COPY;
    return {
      ...DEFAULT_JOBS_COPY,
      ...rawCopy,
      sections: {
        ...DEFAULT_JOBS_COPY.sections,
        ...(rawCopy.sections ?? {}),
      },
      teams: {
        ...DEFAULT_JOBS_COPY.teams,
        ...(rawCopy.teams ?? {}),
      },
      actions: {
        ...DEFAULT_JOBS_COPY.actions,
        ...(rawCopy.actions ?? {}),
      },
    };
  }, [rawCopy]);
}
