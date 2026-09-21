type MailerEnvironment = Partial<Record<
  | 'BREVO_SMTP_HOST'
  | 'BREVO_SMTP_PORT'
  | 'BREVO_SMTP_USERNAME'
  | 'BREVO_SMTP_PASSWORD'
  | 'CONTACT_SENDER_EMAIL'
  | 'EMAIL_FROM',
  string | undefined
>>;

export function resolveMailerConfig(env: MailerEnvironment) {
  const from = env.CONTACT_SENDER_EMAIL?.trim() || env.EMAIL_FROM?.trim();
  const user = env.BREVO_SMTP_USERNAME?.trim();
  const pass = env.BREVO_SMTP_PASSWORD?.trim();
  const host = env.BREVO_SMTP_HOST?.trim() || 'smtp-relay.sendinblue.com';
  const port = Number(env.BREVO_SMTP_PORT?.trim() || 587);
  if (!from || !user || !pass || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { from, host, port, auth: { user, pass } };
}
