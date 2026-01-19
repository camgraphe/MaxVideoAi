import { ButtonLink } from '@/components/ui/Button';

export function NotFoundContent() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">404</p>
      <h1 className="mt-3 text-3xl font-semibold text-text-primary">Page not found</h1>
      <p className="mt-2 text-base text-text-secondary">
        We can&apos;t find that URL. It might be outdated, or it never existed. Use the links below to keep exploring MaxVideoAI.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <ButtonLink href="/" className="shadow-card">
          Back to homepage
        </ButtonLink>
        <ButtonLink href="/models" variant="outline">
          Browse video models
        </ButtonLink>
      </div>
    </main>
  );
}
