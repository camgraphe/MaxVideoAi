import Link from 'next/link';
import type { ElementType } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import type { LocalizedLinkHref } from '@/i18n/navigation';

type NotFoundContentProps = {
  linkComponent?: ElementType;
  homeHref?: LocalizedLinkHref;
  modelsHref?: LocalizedLinkHref;
  title?: string;
  body?: string;
  homeLabel?: string;
  modelsLabel?: string;
};

export function NotFoundContent({
  linkComponent = Link,
  homeHref = '/',
  modelsHref = '/models',
  title = 'Page not found',
  body = "We can't find that URL. It might be outdated, or it never existed. Use the links below to keep exploring MaxVideoAI.",
  homeLabel = 'Back to homepage',
  modelsLabel = 'Browse video models',
}: NotFoundContentProps) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">404</p>
      <h1 className="mt-3 text-3xl font-semibold text-text-primary">{title}</h1>
      <p className="mt-2 text-base text-text-secondary">{body}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <ButtonLink href={homeHref} className="shadow-card" linkComponent={linkComponent}>
          {homeLabel}
        </ButtonLink>
        <ButtonLink href={modelsHref} variant="outline" linkComponent={linkComponent}>
          {modelsLabel}
        </ButtonLink>
      </div>
    </main>
  );
}
