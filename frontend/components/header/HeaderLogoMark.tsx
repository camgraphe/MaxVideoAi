'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/I18nProvider';

export function HeaderLogoMark() {
  const { t } = useI18n();
  return (
    <Link href="/" className="flex items-center gap-2" aria-label={t('workspace.header.logoAria', 'Go to marketing homepage')}>
      <Image src="/assets/branding/logo-mark.svg" alt="MaxVideoAI" width={32} height={32} className="shrink-0" priority />
      <span className="text-sm font-semibold tracking-normal text-text-primary sm:text-lg">MaxVideoAI</span>
    </Link>
  );
}
