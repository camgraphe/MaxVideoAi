'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';

type ObfuscatedEmailLinkProps = {
  user: string;
  domain: string;
  /**
   * Optional label to display once the real email is hydrated.
   * Falls back to the computed email address if omitted.
   */
  label?: string;
  /**
   * Placeholder text rendered during SSR so Cloudflare never sees the real address.
   * Defaults to "user [at] domain".
   */
  placeholder?: string;
  /**
   * If true, skip the default brand styles so callers can control the appearance entirely.
   */
  unstyled?: boolean;
  className?: string;
};

/**
 * Renders an email CTA without placing the raw address in the SSR HTML.
 * The final mailto link is hydrated on the client to avoid Cloudflare email-decoder injection.
 */
export function ObfuscatedEmailLink({
  user,
  domain,
  label,
  placeholder,
  unstyled = false,
  className,
}: ObfuscatedEmailLinkProps) {
  const [hydrated, setHydrated] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
    const computed = `${user}@${domain}`;
    setEmail(computed);
  }, [user, domain]);

  const linkClassName = clsx(unstyled ? undefined : 'font-semibold text-brand hover:text-brandHover', className);
  const safePlaceholder = placeholder ?? `${user} [at] ${domain}`;
  const hydratedLabel = label ?? email ?? safePlaceholder;

  if (!hydrated || !email) {
    return (
      <span className={linkClassName} aria-label={`Email ${user} at ${domain}`}>
        {safePlaceholder}
      </span>
    );
  }

  return (
    <a
      href={`mailto:${email}`}
      className={linkClassName}
      aria-label={`Email ${email}`}
    >
      {hydratedLabel}
    </a>
  );
}
