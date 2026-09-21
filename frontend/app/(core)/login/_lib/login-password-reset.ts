type PasswordResetResult = 'sent' | 'rateLimited' | 'unavailable';

/** Keep transport/SMTP details out of the form, including SDK errors with message "{}". */
export async function requestPasswordReset(
  request: () => Promise<{ error: unknown }>
): Promise<PasswordResetResult> {
  try {
    const { error } = await request();
    if (!error) return 'sent';
    if (typeof error === 'object') {
      const details = error as { status?: number; code?: string };
      if (details.status === 429 || details.code === 'over_email_send_rate_limit') return 'rateLimited';
    }
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}
