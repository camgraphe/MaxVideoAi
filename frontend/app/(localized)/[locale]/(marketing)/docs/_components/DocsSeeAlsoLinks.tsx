import { Link } from '@/i18n/navigation';
import type { DocsSeeAlsoLink } from '../_lib/docs-index-data';

type DocsSeeAlsoLinksProps = {
  label: string;
  links?: DocsSeeAlsoLink[];
};

export function DocsSeeAlsoLinks({ label, links }: DocsSeeAlsoLinksProps) {
  if (!links?.length) {
    return null;
  }

  return (
    <p className="mt-3 text-sm">
      <span className="text-muted-foreground">{label}</span>{' '}
      {links.map((link, linkIndex) => (
        <span key={link.href}>
          <Link className="underline underline-offset-2" href={link.href}>
            {link.label}
          </Link>
          {linkIndex < links.length - 1 ? ', ' : null}
        </span>
      ))}
    </p>
  );
}
