import { Link, type LocalizedLinkHref } from '@/i18n/navigation';

export type PricingRelatedLink = {
  href: LocalizedLinkHref;
  label: string;
};

type PricingRelatedLinksSectionProps = {
  links: PricingRelatedLink[];
  title: string;
};

export function PricingRelatedLinksSection({ links, title }: PricingRelatedLinksSectionProps) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-4 text-sm text-text-secondary shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">{title}</span>
        <div className="flex flex-wrap gap-2">
          {links.map((link) => {
            const key = `${link.label}-${typeof link.href === 'string' ? link.href : link.href.pathname}`;
            return (
              <Link
                key={key}
                href={link.href}
                className="inline-flex min-h-8 items-center rounded-full border border-hairline bg-bg px-3 text-xs font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
