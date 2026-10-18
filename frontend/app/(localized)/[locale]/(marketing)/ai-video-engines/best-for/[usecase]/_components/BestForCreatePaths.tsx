import { ArrowUpRight, Clapperboard, MessageCircle, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { EDITORIAL_COPY as C } from '../_lib/best-for-editorial-copy';

export function BestForCreatePaths({ locale }: { locale: AppLocale }) {
  const paths = [
    { href: '/app' as const, title: C.create[locale], body: C.createBody[locale], Icon: Clapperboard },
    { href: '/studio' as const, title: C.studio[locale], body: C.studioBody[locale], Icon: Sparkles },
    { href: '/mcp' as const, title: C.assistant[locale], body: C.assistantBody[locale], Icon: MessageCircle },
  ];
  return <section className="bf-create" aria-labelledby="bf-create-title">
    <h2 id="bf-create-title">{C.createTitle[locale]}</h2>
    <div className="bf-create-grid">{paths.map(({ href, title, body, Icon }) => <Link key={href} href={href} className="bf-create-path">
      <Icon size={26} strokeWidth={1.5} aria-hidden /><h3>{title}<ArrowUpRight size={19} aria-hidden /></h3><p>{body}</p>
    </Link>)}</div>
    <p className="bf-fineprint">{C.costs[locale]} <Link href="/pricing">{locale === 'fr' ? 'Tarifs' : locale === 'es' ? 'Precios' : 'Pricing'} →</Link></p>
  </section>;
}
