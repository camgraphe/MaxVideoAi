import type { AnchorHTMLAttributes, ElementType, ReactNode } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import type { LinkProps } from 'next/link';

type TextLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: LinkProps['href'];
  children: ReactNode;
  linkComponent?: ElementType;
};

const baseClasses =
  'inline-flex items-center font-semibold text-brand transition hover:text-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white';

export function TextLink({
  href,
  children,
  className,
  linkComponent: LinkComponent = Link,
  ...props
}: TextLinkProps) {
  return (
    <LinkComponent href={href} className={clsx(baseClasses, className)} {...props}>
      {children}
    </LinkComponent>
  );
}
