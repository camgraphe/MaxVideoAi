import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { ENV } from '@/lib/env';
import { resolveMailerConfig } from './mailer-config';

let cachedTransport: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null = null;

export function getMailer():
  | nodemailer.Transporter<SMTPTransport.SentMessageInfo>
  | null {
  const config = resolveMailerConfig(ENV);
  if (!config) {
    return null;
  }
  if (cachedTransport) {
    return cachedTransport;
  }
  cachedTransport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: true,
    auth: config.auth,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return cachedTransport;
}

export function getDefaultFromAddress(): string | undefined {
  return ENV.CONTACT_SENDER_EMAIL ?? ENV.EMAIL_FROM;
}
