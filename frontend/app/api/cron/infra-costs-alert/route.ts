import { NextRequest, NextResponse } from 'next/server';
import { resolveConfiguredLocalAdminUserId } from '@/server/admin';
import { logAdminAction } from '@/server/admin-audit';
import { getDefaultFromAddress, getMailer } from '@/server/mailer';
import { postSlackMessage } from '@/server/slack';
import { authorizeCronRequest } from '@/server/vercel-cron';
import {
  buildInfraCostAlertDigest,
  fetchInfraCostsReport,
  INFRA_COST_ALERT_ACTION,
} from '@/server/infra-costs';

export const runtime = 'nodejs';

const CRON_SECRET = (process.env.CRON_SECRET ?? '').trim();

function unauthorized(reason: string, req: NextRequest) {
  console.warn('[infra-costs-alert] unauthorized', {
    reason,
    cron: req.headers.get('x-vercel-cron') || null,
    ua: req.headers.get('user-agent') || null,
    deployment: req.headers.get('x-vercel-deployment-id') || null,
    source: req.headers.get('x-vercel-source') || null,
  });
  return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
}

function authorize(req: NextRequest): NextResponse | null {
  const auth = authorizeCronRequest(req.headers, {
    cronSecret: CRON_SECRET,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    overrideHeaderName: 'x-cron-key',
    vercelEnv: process.env.VERCEL,
  });
  if (!auth.ok) {
    return unauthorized(auth.reason, req);
  }
  return null;
}

export async function GET(req: NextRequest) {
  const unauthorizedResponse = authorize(req);
  if (unauthorizedResponse) return unauthorizedResponse;

  const report = await fetchInfraCostsReport();
  const digest = buildInfraCostAlertDigest(report);
  let auditLogged = false;
  let emailSent = false;
  let slackAttempted = false;

  if (digest.level !== 'ok') {
    const adminId = await resolveAlertAdminId();
    if (adminId) {
      await logAdminAction({
        adminId,
        action: INFRA_COST_ALERT_ACTION,
        route: '/api/cron/infra-costs-alert',
        metadata: digest.metadata,
      });
      auditLogged = true;
    }

    if ((process.env.SLACK_WEBHOOK_URL ?? '').trim()) {
      await postSlackMessage(digest.summary, digest.metadata);
      slackAttempted = true;
    }

    emailSent = await sendAlertEmail(digest.summary, digest.text);
  }

  return NextResponse.json({
    ok: true,
    level: digest.level,
    currentUsd: report.money.currentUsd,
    projectedMonthUsd: report.money.projectedMonthUsd,
    auditLogged,
    emailSent,
    slackAttempted,
    alerts: report.alerts.length,
  });
}

async function resolveAlertAdminId(): Promise<string | null> {
  const explicit = (process.env.INFRA_COST_ALERT_ADMIN_ID ?? '').trim();
  if (explicit) return explicit;
  return resolveConfiguredLocalAdminUserId();
}

async function sendAlertEmail(subject: string, text: string): Promise<boolean> {
  const to = (process.env.INFRA_COST_ALERT_EMAIL_TO ?? '').trim();
  if (!to) return false;

  const mailer = getMailer();
  const from = getDefaultFromAddress();
  if (!mailer || !from) return false;

  try {
    await mailer.sendMail({
      to,
      from,
      subject,
      text,
      html: `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap;">${escapeHtml(text)}</pre>`,
    });
    return true;
  } catch (error) {
    console.warn('[infra-costs-alert] email failed', error);
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
