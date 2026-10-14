import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { getPublicTurnstileConfiguration } from '@/server/turnstile-widgets';
import { TurnstileDiagnostic } from './_components/TurnstileDiagnostic.client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function TurnstileDiagnosticPage() {
  await requireAdmin();
  if (process.env.TURNSTILE_DIAGNOSTICS_ENABLED !== '1') notFound();
  const configuration = getPublicTurnstileConfiguration();
  if (!configuration.configured) {
    return <p role="alert">Turnstile configuration is incomplete. Diagnostic validation is unavailable.</p>;
  }
  return <TurnstileDiagnostic activeSiteKey={configuration.activeSiteKey} widgets={configuration.widgets} />;
}
