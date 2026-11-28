import Image from 'next/image';
import Link from 'next/link';
import { buildLoginHref } from '@/lib/auth-entry-href';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import type { AppLocale } from '@/i18n/locales';
import { getMcpEditorialCopy } from './mcp-editorial-copy';
import { mcpHubCopy } from './mcp-hub-copy';

export function McpTrustStrip({ locale }: {locale: AppLocale}) {
  const copy = getMcpEditorialCopy(locale);
  const labels = mcpHubCopy[locale];
  const nextPath = localizePathFromEnglish(locale, '/mcp');
  return <section id="credits" className="container-page hub-wallet">
    <div className="hub-wallet-panel">
      <div><Image src="/assets/branding/logo-mark.svg" width={32} height={32} alt=""/>
        <h2>{labels.wallet}</h2><p>{labels.balance}</p>
        <div className="hub-resource-links"><Link href={buildLoginHref({mode:'signin', nextPath, locale})}>{labels.signIn}</Link><Link href={buildLoginHref({mode:'signup', nextPath, locale})}>{labels.signUp}</Link></div>
      </div>
      <div className="hub-wallet-answers">
        <p>{copy.note}</p>
        <div className="hub-resource-links"><Link href="/billing">{labels.manage} →</Link><Link href={localizePathFromEnglish(locale, '/pricing')}>{labels.price} →</Link></div>
        <details><summary>{copy.trustTitle}</summary>{copy.trust.map(item => <div key={item.title}><h3>{item.title}</h3><p>{item.body}</p></div>)}</details>
      </div>
    </div>
  </section>;
}
