import Link from 'next/link';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-bg py-10 sm:py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 sm:px-8">
        <header className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold text-text-primary">Legal</h1>
          <Link
            href="/"
            className="text-sm font-medium text-accent transition hover:text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Back to homepage
          </Link>
        </header>
        <section className="space-y-10 rounded-card border border-border bg-white p-6 shadow-card sm:p-10">
          {children}
        </section>
      </div>
    </main>
  );
}
