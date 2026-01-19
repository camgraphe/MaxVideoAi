import Link from 'next/link';

export function NotFoundContent() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">404</p>
      <h1 className="mt-3 text-3xl font-semibold text-text-primary">Page not found</h1>
      <p className="mt-2 text-base text-text-secondary">
        We can&apos;t find that URL. It might be outdated, or it never existed. Use the links below to keep exploring MaxVideoAI.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-input bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand shadow-card transition hover:bg-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to homepage
        </Link>
        <Link
          href="/models"
          className="rounded-input border border-border px-5 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Browse video models
        </Link>
      </div>
    </main>
  );
}
