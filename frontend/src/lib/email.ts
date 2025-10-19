import { render } from '@react-email/render';
import { createElement, type ReactElement } from 'react';
import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import { Resend } from 'resend';
import type { CreateEmailOptions } from 'resend/build/src/emails/interfaces';
import RenderCompletedEmail, { type RenderCompletedEmailProps } from '@/emails/RenderCompletedEmail';
import WalletLowBalanceEmail, { type WalletLowBalanceEmailProps } from '@/emails/WalletLowBalanceEmail';
import { ENV } from '@/lib/env';
import { resolveSiteUrl } from '@/lib/email-links';
import { postSlackMessage } from '@/server/slack';

type EmailProvider = 'resend' | 'smtp';

type TransactionalEmailOptions = {
  to: string | string[];
  subject: string;
  react: ReactElement;
  textFallback?: string;
  headers?: Record<string, string>;
  category?: string;
};

type SendResult = {
  id: string | null;
  provider: EmailProvider;
};

const SUPPORT_EMAIL = 'support@maxvideoai.com';
const CIRCUIT_BREAKER_WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 3;

type CircuitState = {
  openUntil: number;
  failureCount: number;
};

const circuit: Record<EmailProvider, CircuitState> = {
  resend: { openUntil: 0, failureCount: 0 },
  smtp: { openUntil: 0, failureCount: 0 },
};

let resendClient: Resend | null = null;
let smtpTransport: Transporter | null = null;

function toArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function formatFromAddress(): string {
  const fromEmail = ENV.EMAIL_FROM;
  if (!fromEmail) {
    throw new Error('EMAIL_FROM is not configured');
  }
  const fromName = ENV.EMAIL_FROM_NAME;
  return fromName ? `${fromName} <${fromEmail}>` : fromEmail;
}

function isProduction(): boolean {
  const vercelEnv = (process.env.VERCEL_ENV ?? '').toLowerCase();
  if (vercelEnv === 'production') return true;
  if (vercelEnv === 'preview') return false;
  return process.env.NODE_ENV === 'production';
}

function mailtrapConfigured(): boolean {
  return Boolean(ENV.MAILTRAP_HOST && ENV.MAILTRAP_USER && ENV.MAILTRAP_PASS);
}

function ensureResend(): Resend {
  if (!ENV.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  if (!resendClient) {
    resendClient = new Resend(ENV.RESEND_API_KEY);
  }
  return resendClient;
}

function ensureSmtp(): Transporter {
  if (!mailtrapConfigured()) {
    throw new Error('MAILTRAP credentials missing');
  }
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: ENV.MAILTRAP_HOST,
      port: ENV.MAILTRAP_PORT ? Number(ENV.MAILTRAP_PORT) : 587,
      secure: ENV.MAILTRAP_PORT === '465',
      auth: {
        user: ENV.MAILTRAP_USER,
        pass: ENV.MAILTRAP_PASS,
      },
    });
  }
  return smtpTransport;
}

function isCircuitOpen(provider: EmailProvider): boolean {
  const state = circuit[provider];
  if (!state) return false;
  if (state.openUntil > Date.now()) return true;
  if (state.openUntil !== 0) {
    // reset once the window has passed
    state.openUntil = 0;
    state.failureCount = 0;
  }
  return false;
}

function registerFailure(provider: EmailProvider, error: unknown): void {
  const state = circuit[provider];
  if (!state) return;
  state.failureCount += 1;
  if (state.failureCount >= MAX_ATTEMPTS) {
    state.openUntil = Date.now() + CIRCUIT_BREAKER_WINDOW_MS;
  }
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[email:${provider}] send failed`, message);
}

function registerSuccess(provider: EmailProvider): void {
  const state = circuit[provider];
  if (!state) return;
  state.failureCount = 0;
  state.openUntil = 0;
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function renderEmailContent(reactTemplate: ReactElement, explicitText?: string): { html: string; text: string } {
  const html = render(reactTemplate, { pretty: true });
  const text = explicitText ?? render(reactTemplate, { plainText: true });
  return { html, text };
}

async function deliverViaResend(options: TransactionalEmailOptions, html: string, text: string): Promise<SendResult> {
  const resend = ensureResend();
  const payload: CreateEmailOptions = {
    from: formatFromAddress(),
    to: toArray(options.to),
    subject: options.subject,
    html,
    text,
    reply_to: SUPPORT_EMAIL,
    headers: options.headers,
  };
  if (options.category) {
    payload.tags = [{ name: 'category', value: options.category }];
  }
  const response = await resend.emails.send(payload);
  const id = typeof response?.data?.id === 'string' ? response.data.id : null;
  return { id, provider: 'resend' };
}

async function deliverViaSmtp(options: TransactionalEmailOptions, html: string, text: string): Promise<SendResult> {
  const transport = ensureSmtp();
  const payload: SendMailOptions = {
    from: formatFromAddress(),
    to: toArray(options.to),
    subject: options.subject,
    html,
    text,
    headers: {
      'Reply-To': SUPPORT_EMAIL,
      ...(options.headers ?? {}),
    },
  };
  const response = await transport.sendMail(payload);
  const id = typeof response?.messageId === 'string' ? response.messageId : null;
  return { id, provider: 'smtp' };
}

async function attemptWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  let attempt = 0;
  let lastError: unknown = null;
  while (attempt < MAX_ATTEMPTS) {
    try {
      attempt += 1;
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_ATTEMPTS) break;
      await wait(200 * Math.pow(2, attempt - 1));
    }
  }
  throw lastError ?? new Error('Operation failed');
}

function providerOrder(): EmailProvider[] {
  if (isProduction()) {
    return ['resend'];
  }
  if (mailtrapConfigured()) {
    return ['smtp', 'resend'];
  }
  return ['resend'];
}

function shouldNotifySlack(): boolean {
  return isProduction() && Boolean((process.env.SLACK_WEBHOOK_URL ?? '').trim());
}

export async function sendTransactionalEmail(options: TransactionalEmailOptions): Promise<SendResult> {
  const recipients = toArray(options.to).map((item) => item.trim()).filter(Boolean);
  if (!recipients.length) {
    throw new Error('Transactional email requires at least one recipient');
  }

  const { html, text } = renderEmailContent(options.react, options.textFallback);
  const providers = providerOrder();

  for (const provider of providers) {
    if (isCircuitOpen(provider)) {
      continue;
    }
    try {
      const result = await attemptWithRetry(() => (provider === 'resend' ? deliverViaResend(options, html, text) : deliverViaSmtp(options, html, text)));
      registerSuccess(provider);
      return result;
    } catch (error) {
      registerFailure(provider, error);
      if (providers.length === 1 || provider === providers[providers.length - 1]) {
        if (shouldNotifySlack()) {
          await postSlackMessage(':warning: Transactional email delivery failed', {
            provider,
            error: error instanceof Error ? error.message : String(error),
            to: recipients,
            subject: options.subject,
          });
        }
      }
      if (provider === providers[providers.length - 1]) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  throw new Error('No email provider available (circuit breaker active)');
}

const LOW_BALANCE_ALERT_MS = 60 * 60 * 1000;
const LOW_BALANCE_CACHE: Map<string, number> = new Map();

export function shouldThrottleLowBalance(userId: string): boolean {
  const last = LOW_BALANCE_CACHE.get(userId);
  const now = Date.now();
  if (last && now - last < LOW_BALANCE_ALERT_MS) {
    return true;
  }
  LOW_BALANCE_CACHE.set(userId, now);
  return false;
}

const DEFAULT_LOW_BALANCE_THRESHOLD_CENTS = 2000;

function resolveLowBalanceThreshold(): number {
  const raw = process.env.WALLET_LOW_BALANCE_THRESHOLD_CENTS;
  if (!raw) return DEFAULT_LOW_BALANCE_THRESHOLD_CENTS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LOW_BALANCE_THRESHOLD_CENTS;
  return Math.round(parsed);
}

export function getLowBalanceThresholdCents(): number {
  return resolveLowBalanceThreshold();
}

type RenderCompletedParams = Omit<RenderCompletedEmailProps, 'videoUrl' | 'thumbnailUrl'> & {
  to: string | string[];
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
};

export async function sendRenderCompletedEmail(params: RenderCompletedParams): Promise<SendResult> {
  const siteUrl = resolveSiteUrl();
  const template: RenderCompletedEmailProps = {
    recipientName: params.recipientName,
    jobId: params.jobId,
    engineLabel: params.engineLabel,
    durationSec: params.durationSec,
    videoUrl: params.videoUrl ?? `${siteUrl}/jobs`,
    thumbnailUrl: params.thumbnailUrl ?? undefined,
  };

  return sendTransactionalEmail({
    to: params.to,
    subject: 'Ton rendu MaxVideoAI est prêt',
    react: createElement(RenderCompletedEmail, template),
    category: 'render-completed',
    headers: { 'X-MaxVideoAI-Template': 'render-completed' },
  });
}

type WalletLowBalanceParams = Omit<WalletLowBalanceEmailProps, 'thresholdCents'> & {
  to: string | string[];
  thresholdCents?: number;
};

export async function sendWalletLowBalanceEmail(params: WalletLowBalanceParams): Promise<SendResult> {
  const threshold = params.thresholdCents ?? resolveLowBalanceThreshold();
  const template: WalletLowBalanceEmailProps = {
    recipientName: params.recipientName,
    balanceCents: params.balanceCents,
    currency: params.currency,
    thresholdCents: threshold,
  };

  return sendTransactionalEmail({
    to: params.to,
    subject: 'Alerte wallet MaxVideoAI',
    react: createElement(WalletLowBalanceEmail, template),
    category: 'wallet-low-balance',
    headers: { 'X-MaxVideoAI-Template': 'wallet-low-balance' },
  });
}

export { withUtm, resolveSiteUrl } from '@/lib/email-links';
