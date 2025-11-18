import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { ENV } from '@/lib/env';

let cachedTransport: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null = null;

function isSmtpConfigured(): boolean {
  return Boolean(
    ENV.SMTP_HOST &&
      ENV.SMTP_PORT &&
      ENV.SMTP_USERNAME &&
      ENV.SMTP_PASSWORD &&
      ENV.SMTP_FROM
  );
}

export function getMailer():
  | nodemailer.Transporter<SMTPTransport.SentMessageInfo>
  | null {
  if (!isSmtpConfigured()) {
    return null;
  }
  if (cachedTransport) {
    return cachedTransport;
  }
  cachedTransport = nodemailer.createTransport({
    host: ENV.SMTP_HOST,
    port: Number(ENV.SMTP_PORT),
    secure: Number(ENV.SMTP_PORT) === 465,
    auth: {
      user: ENV.SMTP_USERNAME,
      pass: ENV.SMTP_PASSWORD,
    },
  });
  return cachedTransport;
}

export function getDefaultFromAddress(): string | undefined {
  return ENV.SMTP_FROM ?? ENV.EMAIL_FROM;
}
