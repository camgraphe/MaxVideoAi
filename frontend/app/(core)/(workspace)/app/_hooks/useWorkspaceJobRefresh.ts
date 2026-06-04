'use client';

import { useCallback } from 'react';
import { getJobStatus } from '@/lib/api';

export function useWorkspaceJobRefresh() {
  return useCallback(async (jobId: string) => {
    try {
      const status = await getJobStatus(jobId);
      if (status.status === 'failed') {
        throw new Error(status.message ?? 'MaxVideoAI could not complete this render.');
      }
      if (status.status !== 'completed' && !status.videoUrl) {
        throw new Error('This render is still processing.');
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unable to refresh render status.');
    }
  }, []);
}
