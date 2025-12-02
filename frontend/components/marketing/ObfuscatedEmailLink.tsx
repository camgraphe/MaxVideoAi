'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';

type ObfuscatedEmailLinkProps = {
  user: string;
  domain: string;
  label?: string;
  className?: string;
};

/**
 * Renders an email CTA without placing the raw address in the SSR HTML.
 * The final mailto link is hydrated on the client to avoid Cloudflare email-decoder injection.
 */
export function ObfuscatedEmailLink({ user, domain, label, className }: ObfuscatedEmailLinkProps) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setEmail(`${user}@${domain}`);
  }, [user, domain]);

  const display = label ?? (email ? email : `${user} [at] ${domain}`);
  const href = '/contact';

  return (
    <a
      href={href}
      className={clsx('font-semibold text-accent hover:text-accentSoft', className)}
      aria-label={`Email ${email ?? `${user} at ${domain}`}`}
    >
      {display}
    </a>
  );
}
