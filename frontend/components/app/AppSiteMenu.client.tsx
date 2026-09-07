'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AppLanguageToggle } from '@/components/AppLanguageToggle';
import { MARKETING_TOP_NAV_LINKS } from '@/config/navigation';
import { getPathname } from '@/i18n/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { AppGlyph } from './AppGlyph';
import { appNavLabel, getAppMenuItems } from './app-navigation';

type Props = {
  children: ReactNode;
  email: string | null;
  authResolved: boolean;
  isAdmin: boolean;
  signinHref: string;
  signupHref: string;
  themeToggleLabel: string | undefined;
  onToggleTheme: () => void;
  onSignOut: () => void;
};

export function AppSiteMenu({ children, email, authResolved, isAdmin, signinHref, signupHref, themeToggleLabel, onToggleTheme, onSignOut }: Props) {
  const { locale, t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const copy = locale === 'fr'
    ? { menu: 'Menu', close: 'Fermer', site: 'Explorer MaxVideoAI', app: 'Application', preferences: 'Préférences', language: 'Langue', theme: 'Apparence', signIn: 'Connexion', signUp: 'Créer un compte', signOut: 'Déconnexion', assistants: 'Assistants', account: 'Compte', newTab: 'nouvel onglet' }
    : locale === 'es'
      ? { menu: 'Menú', close: 'Cerrar', site: 'Explorar MaxVideoAI', app: 'Aplicación', preferences: 'Preferencias', language: 'Idioma', theme: 'Apariencia', signIn: 'Entrar', signUp: 'Crear cuenta', signOut: 'Cerrar sesión', assistants: 'Asistentes', account: 'Cuenta', newTab: 'pestaña nueva' }
      : { menu: 'Menu', close: 'Close', site: 'Explore MaxVideoAI', app: 'Application', preferences: 'Preferences', language: 'Language', theme: 'Appearance', signIn: 'Sign in', signUp: 'Create account', signOut: 'Sign out', assistants: 'Assistants', account: 'Account', newTab: 'new tab' };
  const open = (trigger: HTMLElement) => {
    openerRef.current = trigger;
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();
  useEffect(() => {
    const dialog = dialogRef.current;
    const restoreFocus = () => openerRef.current?.focus();
    dialog?.addEventListener('close', restoreFocus);
    return () => dialog?.removeEventListener('close', restoreFocus);
  }, []);
  const topPaths = { models: '/models', examples: '/examples', compare: '/ai-video-engines', tools: '/tools', pricing: '/pricing', blog: '/blog' } as const;
  const publicLinks: { key: string; label: string; href: (typeof topPaths)[keyof typeof topPaths] | '/' | '/integrations/claude' | '/integrations/chatgpt' | '/integrations/codex' }[] = [
    { key: 'home', label: locale === 'fr' ? 'Accueil' : locale === 'es' ? 'Inicio' : 'Home', href: '/' },
    ...MARKETING_TOP_NAV_LINKS.map((item) => ({ ...item, href: topPaths[item.key], label: t(`nav.linkLabels.${item.key}`, item.key) ?? item.key })),
    { key: 'claude', label: 'Claude', href: '/integrations/claude' },
    { key: 'chatgpt', label: 'ChatGPT', href: '/integrations/chatgpt' },
    { key: 'codex', label: 'Codex', href: '/integrations/codex' },
  ];
  return (
    <>
      <button className="app-site-trigger" type="button" aria-haspopup="dialog" onClick={(event) => open(event.currentTarget)}>
        <Image src="/assets/branding/logo-mark.svg" width={28} height={28} alt="" aria-hidden="true" />
        <span><strong>MaxVideoAI</strong><small>{copy.menu}</small></span><AppGlyph name="menu" />
      </button>
      <div className="app-header-actions">
        <Link className="app-assistant-shortcut" href={getPathname({ locale, href: '/mcp' })} target="_blank" rel="noopener noreferrer" prefetch={false}>
          <AppGlyph name="connect" /><span>{copy.assistants}</span><span className="sr-only"> ({copy.newTab})</span>
        </Link>
        {children}
        <div className="app-header-account">
          {email ? <button type="button" onClick={(event) => open(event.currentTarget)} aria-haspopup="dialog"><AppGlyph name="settings" /><span>{copy.account}</span></button>
            : authResolved ? <Link href={signinHref} prefetch={false}>{copy.signIn}</Link>
              : <span role="status" aria-label={t('workspace.header.loading', 'Loading account')}>…</span>}
        </div>
      </div>
      <dialog ref={dialogRef} className="app-site-dialog" aria-labelledby={titleId} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div className="app-site-dialog-heading"><h2 id={titleId}>MaxVideoAI</h2><button type="button" onClick={close} autoFocus>{copy.close} ×</button></div>
        <div className="app-site-dialog-body">
          <section aria-labelledby={`${titleId}-app`}><h3 id={`${titleId}-app`}>{copy.app}</h3>
            <nav className="app-complete-menu" aria-label={copy.app}>
              {getAppMenuItems().map((item) => <Link key={item.id} href={item.href} prefetch={false} onClick={close}><AppGlyph name={item.glyph} /><span>{appNavLabel(item, locale)}</span></Link>)}
              {isAdmin ? <Link href="/admin" prefetch={false} onClick={(event) => { event.preventDefault(); close(); window.location.assign('/admin'); }}><AppGlyph name="settings" /><span>Admin</span></Link> : null}
            </nav>
          </section>
          <section aria-labelledby={`${titleId}-site`}><h3 id={`${titleId}-site`}>{copy.site}</h3>
            <nav className="app-public-menu" aria-label={copy.site}>
              {publicLinks.map((item) => <Link key={item.key} href={getPathname({ locale, href: item.href })} prefetch={false} target="_blank" rel="noopener noreferrer" onClick={close}><span>{item.label}</span><AppGlyph name="external" /><span className="sr-only"> ({copy.newTab})</span></Link>)}
            </nav>
          </section>
          <section className="app-site-preferences" aria-labelledby={`${titleId}-preferences`}><h3 id={`${titleId}-preferences`}>{copy.preferences}</h3>
            <div><span>{copy.language}</span><AppLanguageToggle /></div>
            <div><span>{copy.theme}</span><button type="button" onClick={onToggleTheme}>{themeToggleLabel}</button></div>
          </section>
          <div className="app-site-auth">
            {email ? <><span>{email}</span><button type="button" onClick={() => { close(); onSignOut(); }}>{copy.signOut}</button></>
              : authResolved ? <><Link href={signinHref} prefetch={false} onClick={close}>{copy.signIn}</Link><Link href={signupHref} prefetch={false} onClick={close}>{copy.signUp}</Link></> : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
