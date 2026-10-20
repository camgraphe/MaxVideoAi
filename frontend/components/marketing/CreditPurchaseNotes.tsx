import NextLink from 'next/link';
import { Link } from '@/i18n/navigation';

type CreditPurchaseNotesCopy = {
  title: string;
  items: Array<{ title: string; body: string }>;
  links: { termsHref: string; terms: string; refunds: string; support: string; studio: string };
};

/** Presentation only; each route owns its complete localized purchase copy. */
export function CreditPurchaseNotes({ copy }: { copy: CreditPurchaseNotesCopy }) {
  const linkClass = 'inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline';
  return (
    <aside className="mt-6 rounded-[8px] border border-hairline bg-bg p-5">
      <h3 className="text-lg font-semibold text-text-primary">{copy.title}</h3>
      <dl className="mt-4 grid gap-5 md:grid-cols-3">
        {copy.items.map((item) => (
          <div key={item.title}>
            <dt className="text-sm font-semibold text-text-primary">{item.title}</dt>
            <dd className="mt-2 text-sm leading-6 text-text-secondary">{item.body}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
        <Link href={copy.links.termsHref} className={linkClass}>{copy.links.terms}</Link>
        <NextLink href="/return-policy#refund-review" className={linkClass}>{copy.links.refunds}</NextLink>
        <Link href="/contact" className={linkClass}>{copy.links.support}</Link>
        <Link href="/studio" className={linkClass}>{copy.links.studio}</Link>
      </div>
    </aside>
  );
}
