'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { Chip } from '@/components/ui/Chip';
import { NAV_ITEMS } from '@/components/AppSidebar';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function HeaderBar() {
  const [email, setEmail] = useState<string | null>(null);
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [member, setMember] = useState<{ tier: string } | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let mounted = true;
    const fetchAccountState = async (token?: string | null) => {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      try {
        const [walletRes, memberRes] = await Promise.all([
          fetch('/api/wallet', { headers }).then((r) => r.json()),
          fetch('/api/member-status', { headers }).then((r) => r.json()),
        ]);
        if (!mounted) return;
        setWallet({ balance: walletRes.balance ?? 0 });
        setMember({ tier: memberRes.tier ?? 'Member' });
      } catch {
        if (mounted) {
          setWallet(null);
          setMember(null);
        }
      }
    };
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.session?.user?.email ?? null);
      void fetchAccountState(data.session?.access_token);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
      void fetchAccountState(session?.access_token);
    });
    const handleInvalidate = async () => {
      const { data } = await supabase.auth.getSession();
      await fetchAccountState(data.session?.access_token);
    };
    window.addEventListener('wallet:invalidate', handleInvalidate);
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      window.removeEventListener('wallet:invalidate', handleInvalidate);
    };
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (avatarRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setAccountMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [accountMenuOpen]);

  const initials = useMemo(() => {
    if (!email) return '?';
    const [namePart] = email.split('@');
    if (!namePart) return email.slice(0, 2).toUpperCase();
    const tokens = namePart.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
    if (tokens.length >= 2) {
      return (tokens[0][0] + tokens[1][0]).toUpperCase();
    }
    return namePart.slice(0, 2).toUpperCase();
  }, [email]);

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 flex h-[var(--header-height)] items-center justify-between px-6 lg:px-8',
        'border-b border-border bg-white/80 backdrop-blur-xl'
      )}
    >
      <div className="flex items-center gap-6">
        <LogoMark />
        <nav className="hidden md:flex items-center gap-5 text-sm text-text-muted">
          {[
            ['Home', '#'],
            ['Pricing', '#'],
            ['Docs', '#'],
            ['Jobs', '#']
          ].map(([label, href]) => (
            <a key={label} href={href} className="font-medium transition-colors hover:text-text-secondary">
              {label}
            </a>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3 text-xs text-text-muted">
        <div className="flex items-center gap-2 rounded-input border border-hairline bg-white/80 px-3 py-1 uppercase tracking-micro">
          <Image src="/assets/icons/wallet.svg" alt="" width={16} height={16} aria-hidden />
          <span>Wallet</span>
          <span className="text-sm font-semibold tracking-normal text-text-primary">${(wallet?.balance ?? 0).toFixed(2)}</span>
        </div>
        <Chip className="px-2.5 py-1 text-[12px]" variant="outline">{member?.tier ?? 'Member'}</Chip>
        {email ? (
          <div className="relative">
            <button
              ref={avatarRef}
              type="button"
              onClick={() => setAccountMenuOpen((prev) => !prev)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white/80 text-sm font-semibold text-text-primary transition hover:bg-accentSoft/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
            >
              {initials}
            </button>
            {accountMenuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 mt-3 w-56 rounded-card border border-hairline bg-white p-3 text-sm text-text-secondary shadow-card"
                role="menu"
              >
                <div className="mb-3 rounded-input bg-bg px-3 py-2">
                  <p className="text-xs uppercase tracking-micro text-text-muted">Signed in</p>
                  <p className="mt-1 truncate text-sm font-medium text-text-primary">{email}</p>
                </div>
                <nav className="mb-2 flex flex-col gap-1" aria-label="Primary navigation">
                  {NAV_ITEMS.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      role="menuitem"
                      className="flex items-center justify-between rounded-input px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-accentSoft/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <span>{item.label}</span>
                      {item.badge ? (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-micro text-accent">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </nav>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-input px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-accentSoft/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={async () => {
                    setAccountMenuOpen(false);
                    await supabase.auth.signOut();
                  }}
                >
                  Sign out
                  <span className="text-[11px] uppercase tracking-micro text-text-muted">⌘⇧Q</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="flex h-10 items-center justify-center rounded-input border border-hairline bg-white/80 px-3 text-sm font-medium text-text-primary transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <Link href="/" className="flex items-center" aria-label="Go to home">
      <Image
        src="/assets/branding/logo-dark.svg"
        alt="MaxVideoAI logo"
        width={256}
        height={58}
        className="h-14 w-auto"
        priority
      />
      <span className="ml-2 text-lg font-semibold tracking-tight text-accent">MaxVideoAI</span>
    </Link>
  );
}
