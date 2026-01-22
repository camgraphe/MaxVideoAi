import { forwardRef } from 'react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ElementType, ReactNode } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import type { LocalizedLinkHref } from '@/i18n/navigation';

type ButtonVariant = 'primary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

const baseClasses =
  'inline-flex items-center justify-center gap-2 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brandHover active:bg-brandActive',
  outline: 'border border-hairline text-text-primary hover:border-border-hover hover:bg-surface-hover active:border-border-hover active:bg-surface-2',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-hover active:bg-surface-2',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] rounded-input px-3 py-1.5 text-xs',
  md: 'min-h-[44px] rounded-input px-4 py-2 text-sm',
  lg: 'min-h-[48px] rounded-input px-6 py-3 text-sm',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    />
  );
});

type ButtonLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: LocalizedLinkHref;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  linkComponent?: ElementType;
  prefetch?: boolean;
};

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  size = 'md',
  className,
  linkComponent: LinkComponent = Link,
  ...props
}: ButtonLinkProps) {
  return (
    <LinkComponent
      href={href}
      className={clsx(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {children}
    </LinkComponent>
  );
}
