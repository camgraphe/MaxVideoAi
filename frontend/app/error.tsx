'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App route error boundary caught an error:', error);
  }, [error]);

  return (
    <div className="container-page section max-w-3xl">
      <div className="rounded-card border border-hairline bg-surface p-6 shadow-card">
        <h1 className="text-2xl font-semibold text-text-primary">Something went wrong</h1>
        <p className="mt-2 text-sm text-text-secondary">
          We hit a temporary issue while rendering this page.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex min-h-[36px] items-center rounded-input border border-hairline px-3 py-1.5 text-sm font-semibold text-text-primary transition hover:bg-surface-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
