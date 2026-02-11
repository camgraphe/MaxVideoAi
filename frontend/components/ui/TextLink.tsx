import type { AnchorHTMLAttributes, ElementType, ReactNode } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import type { LocalizedLinkHref } from '@/i18n/navigation';
import { applyNofollowRel } from '@/lib/seo/nofollow';

type TextLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: LocalizedLinkHref;
  children: ReactNode;
  linkComponent?: ElementType;
  prefetch?: boolean;
};

const baseClasses =
  'inline-flex items-center font-semibold text-link transition hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

export function TextLink({
  href,
  children,
  className,
  linkComponent: LinkComponent = Link,
  ...props
}: TextLinkProps) {
  const resolvedRel = applyNofollowRel(props.rel, href);
  return (
    <LinkComponent href={href} className={clsx(baseClasses, className)} {...props} rel={resolvedRel}>
      {children}
    </LinkComponent>
  );
}
