import { query } from '@/lib/db';

const DEFAULT_SERVICE_NOTICE = {
  enabled: false,
  message: '',
};

type ServiceNoticeRow = {
  value: {
    enabled?: boolean;
    message?: string;
  } | null;
};

export type ServiceNoticeSetting = {
  enabled: boolean;
  message: string;
};

const SERVICE_NOTICE_KEY = 'service_notice';

export async function getServiceNoticeSetting(): Promise<ServiceNoticeSetting> {
  if (!process.env.DATABASE_URL) {
    return DEFAULT_SERVICE_NOTICE;
  }

  try {
    const rows = await query<ServiceNoticeRow>('SELECT value FROM app_settings WHERE key = $1 LIMIT 1', [
      SERVICE_NOTICE_KEY,
    ]);
    if (!rows.length || !rows[0].value) {
      return DEFAULT_SERVICE_NOTICE;
    }
    const payload = rows[0].value;
    const message =
      typeof payload.message === 'string' ? payload.message.trim() : DEFAULT_SERVICE_NOTICE.message;
    const enabled = Boolean(payload.enabled && message.length > 0);
    return {
      enabled,
      message,
    };
  } catch (error) {
    console.error('[service-notice] failed to load settings', error);
    return DEFAULT_SERVICE_NOTICE;
  }
}

export async function setServiceNoticeSetting(
  setting: ServiceNoticeSetting,
  adminUserId?: string | null
): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not configured; cannot update service notice');
  }
  const normalizedMessage = setting.message.trim();
  const payload = {
    enabled: Boolean(setting.enabled && normalizedMessage.length > 0),
    message: normalizedMessage,
  };
  await query(
    `
      INSERT INTO app_settings (key, value, updated_at, updated_by)
      VALUES ($1, $2::jsonb, NOW(), $3)
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
    `,
    [SERVICE_NOTICE_KEY, JSON.stringify(payload), adminUserId ?? null]
  );
}
