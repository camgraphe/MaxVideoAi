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
   * Fallback href while the component is still rendering on the server.
   * Defaults to the contact page so users still have a way to reach us if JS is disabled.
   */
  fallbackHref?: string;
  /**
   * If true, skip the default accent styles so callers can control the appearance entirely.
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
  fallbackHref = '/contact',
  unstyled = false,
  className,
}: ObfuscatedEmailLinkProps) {
  const [email, setEmail] = useState<string | null>(null);
  const [href, setHref] = useState<string>(fallbackHref);

  useEffect(() => {
    const computed = `${user}@${domain}`;
    setEmail(computed);
    setHref(`mailto:${computed}`);
  }, [user, domain]);

  const safePlaceholder = placeholder ?? `${user} [at] ${domain}`;
  const display = email ? label ?? email : safePlaceholder;

  return (
    <a
      href={href}
      className={clsx(unstyled ? undefined : 'font-semibold text-brand hover:text-brandHover', className)}
      aria-label={`Email ${email ?? `${user} at ${domain}`}`}
    >
      {display}
    </a>
  );
}
