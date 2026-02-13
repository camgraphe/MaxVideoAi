import type { NextPageContext } from 'next';

type ErrorPageProps = {
  statusCode?: number;
};

function ErrorPage({ statusCode }: ErrorPageProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-3 px-6 py-16 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Unexpected error</p>
      <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{statusCode ?? 500}</h1>
      <p className="text-base text-text-secondary">An unexpected error occurred while loading this page.</p>
    </main>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext): ErrorPageProps => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 500;
  return { statusCode };
};

export default ErrorPage;
