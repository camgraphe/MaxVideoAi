import Image from 'next/image';
import Link from 'next/link';
import type { AppLocale } from '@/i18n/locales';
import { guideLabels } from '../_content/guide-presentation';

export function IntegrationGuideAccount({ locale, plugin = false }: { locale: AppLocale; plugin?: boolean }) {
  const copy = guideLabels[locale];
  return <div className="guide-account-strip">
    <Image src="/assets/branding/logo-mark.svg" width={24} height={24} alt="" aria-hidden="true" />
    <div><p>{plugin ? copy.pluginAccount : copy.account} <Link href={`/login?mode=signin&lang=${locale}`}>{copy.signin}</Link> {copy.or}{' '}
      <Link href={`/login?mode=signup&lang=${locale}`}>{copy.signup}</Link>.</p>
      <p><Link href="/billing">{copy.billing}</Link> {copy.shared}</p>
    </div>
  </div>;
}
