'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, XCircle } from 'lucide-react';

type CheckoutSessionExpireButtonProps = {
  attemptId: number;
  sessionId: string;
};

export function CheckoutSessionExpireButton({ attemptId, sessionId }: CheckoutSessionExpireButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExpire() {
    if (pending) return;
    const confirmed = window.confirm('Expire this open unpaid Stripe Checkout session?');
    if (!confirmed) return;

    setPending(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/checkout-sessions/expire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, sessionId }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Failed to expire Checkout session');
      }
      setMessage('Expired');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-w-[92px] flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleExpire}
        disabled={pending}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-error-border bg-error-bg px-2.5 text-xs font-semibold text-error transition hover:bg-error-bg/80 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
        Expire
      </button>
      {message ? <span className="max-w-[160px] text-[11px] leading-4 text-text-muted">{message}</span> : null}
    </div>
  );
}
