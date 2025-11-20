import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { ENV } from '@/lib/env';

let cachedTransport: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null = null;

function isBrevoConfigured(): boolean {
  return Boolean(
    ENV.BREVO_SMTP_HOST &&
      ENV.BREVO_SMTP_PORT &&
      ENV.BREVO_SMTP_USERNAME &&
      ENV.BREVO_SMTP_PASSWORD &&
      ENV.CONTACT_SENDER_EMAIL
  );
}

export function getMailer():
  | nodemailer.Transporter<SMTPTransport.SentMessageInfo>
  | null {
  if (!isBrevoConfigured()) {
    return null;
  }
  if (cachedTransport) {
    return cachedTransport;
  }
  const host = ENV.BREVO_SMTP_HOST || 'smtp-relay.sendinblue.com';
  const port = Number(ENV.BREVO_SMTP_PORT || 587);
  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: ENV.BREVO_SMTP_USERNAME!,
      pass: ENV.BREVO_SMTP_PASSWORD!,
    },
  });
  return cachedTransport;
}

export function getDefaultFromAddress(): string | undefined {
  return ENV.CONTACT_SENDER_EMAIL ?? ENV.EMAIL_FROM ?? ENV.BREVO_SMTP_USERNAME;
}
