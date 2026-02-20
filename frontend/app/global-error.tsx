'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global route error boundary caught an error:', error);
  }, [error]);

  return (
    <html>
      <body className="bg-bg text-text-primary">
        <main className="container-page section max-w-3xl">
          <div className="rounded-card border border-hairline bg-surface p-6 shadow-card">
            <h1 className="text-2xl font-semibold">Unexpected application error</h1>
            <p className="mt-2 text-sm text-text-secondary">
              The app failed to render this route. Please retry.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 inline-flex min-h-[36px] items-center rounded-input border border-hairline px-3 py-1.5 text-sm font-semibold transition hover:bg-surface-2"
            >
              Reload route
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
