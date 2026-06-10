import { isDatabaseConfigured } from '@/lib/db';
import { isStorageConfigured } from '@/server/storage';

export function assertTimelineExportWorkerEnvironment(params: {
  once: boolean;
  env?: NodeJS.ProcessEnv;
}): void {
  const env = params.env ?? process.env;
  if (env.NODE_ENV === 'production' && !params.once) {
    throw new Error('TIMELINE_EXPORT_WORKER_REQUIRES_ONCE');
  }
  if (!isDatabaseConfigured()) {
    throw new Error('TIMELINE_EXPORT_WORKER_DATABASE_NOT_CONFIGURED');
  }
  if (!isStorageConfigured()) {
    throw new Error('TIMELINE_EXPORT_WORKER_STORAGE_NOT_CONFIGURED');
  }
  if (env.NODE_ENV === 'production' && !env.CHROME_BIN && !env.PUPPETEER_EXECUTABLE_PATH) {
    throw new Error('TIMELINE_EXPORT_WORKER_CHROMIUM_NOT_CONFIGURED');
  }
}
