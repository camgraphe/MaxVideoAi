import { isDatabaseConfigured, query } from '@/lib/db';
import { ENV } from '@/lib/env';
import { postSlackMessage } from '@/server/slack';

type CreateLegalReportInput = {
  email: string;
  url: string;
  reason: string;
  details: string;
  attachmentName?: string | null;
  attachmentBase64?: string | null;
};

const LEGAL_NOTIFY_EMAIL = (process.env.LEGAL_NOTIFY_EMAIL ?? '').trim();

export async function createLegalReport(input: CreateLegalReportInput): Promise<{ id: string }> {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is not configured');
  }

  const params = [
    input.email,
    input.url,
    input.reason,
    input.details,
    input.attachmentName ?? null,
    input.attachmentBase64 ?? null,
  ];

  const rows = await query<{ id: string }>(
    `
      INSERT INTO legal_reports (
        email,
        url,
        reason,
        details,
        attachment_filename,
        attachment_base64
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    params
  );

  const record = rows[0];
  if (!record?.id) {
    throw new Error('Failed to create legal report');
  }

  await notifyLegalTeam(record.id, input);

  return { id: record.id };
}

async function notifyLegalTeam(reportId: string, payload: CreateLegalReportInput): Promise<void> {
  if (LEGAL_NOTIFY_EMAIL && ENV.RESEND_API_KEY && ENV.EMAIL_FROM) {
    const { Resend } = await import('resend');
    const resend = new Resend(ENV.RESEND_API_KEY);
    const subject = `[MaxVideoAI] New legal report (${payload.reason})`;
    const attachment =
      payload.attachmentBase64 && payload.attachmentName
        ? [
            {
              filename: payload.attachmentName,
              content: payload.attachmentBase64,
            },
          ]
        : undefined;

    try {
      await resend.emails.send({
        from: ENV.EMAIL_FROM,
        to: LEGAL_NOTIFY_EMAIL,
        subject,
        text: [
          `Report ID: ${reportId}`,
          `Email: ${payload.email}`,
          `URL: ${payload.url}`,
          `Reason: ${payload.reason}`,
          '',
          payload.details,
        ].join('\n'),
        attachments: attachment,
      });
      return;
    } catch (error) {
      console.warn('[legal-report] failed to send email notification', error instanceof Error ? error.message : error);
    }
  }

  await postSlackMessage('New legal report received', {
    id: reportId,
    email: payload.email,
    url: payload.url,
    reason: payload.reason,
  });
}
