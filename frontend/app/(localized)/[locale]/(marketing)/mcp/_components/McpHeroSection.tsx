import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { buildLoginHref } from '@/lib/auth-entry-href';
import { getMcpClientActionConfig } from '@/lib/mcp-integration-registry';
import { McpIntegrationMark } from '@/components/marketing/mcp/McpIntegrationMark';
import { McpDirectoryInstallLink } from '@/components/marketing/mcp/McpDirectoryInstallLink.client';
import type { McpPageCopy } from '../_lib/mcp-page-types';
import { mcpHubCopy } from '@/components/marketing/mcp/mcp-hub-copy';
import { McpHubDirectory } from './McpHubDirectory';

export function McpHeroSection({ locale, publication, copy }: {
  locale: AppLocale; publication: McpPublicationState; copy: McpPageCopy;
}) {
  const labels = mcpHubCopy[locale];
  const listing = getMcpClientActionConfig('chatgpt');
  const installUrl = publication.connectionAvailable && listing.deepLinkEnabled ? listing.deepLink : null;
  const live = publication.connectionAvailable && publication.showPaidGenerationClaim;
  const nextPath = locale === 'en' ? '/mcp' : `/${locale}/mcp`;
  const screenshot = '/media/mcp/hub-redesign/maya-chatgpt.webp';
  const image = {
    src: screenshot, alt: labels.alt, width: 2048, height: 1050,
    sizes: '(min-width: 1280px) 600px, (min-width: 700px) 46vw, 94vw',
  };
  const { srcSet, sizes } = getImageProps(image).props;

  return (
    <header className="hub-opening">
      {live && <link rel="preload" as="image" media="(min-width: 700px)" imageSrcSet={srcSet} imageSizes={sizes} fetchPriority="high" />}
      <div className="container-page hub-opening-grid">
        <div className="hub-arrival">
          <h1>{labels.brandFirst ? <>MaxVideoAI <span>{labels.title}</span></> : <><span>{labels.title}</span> MaxVideoAI</>}</h1>
          <p className="hub-lead">{live ? labels.lead : copy.hero.previewIntro}</p>
          {live && <p className="hub-account">{labels.beforeSignIn}<Link href={buildLoginHref({ mode: 'signin', locale, nextPath })}>{labels.signIn}</Link>{labels.or}<Link href={buildLoginHref({ mode: 'signup', locale, nextPath })}>{labels.signUp}</Link>{labels.beforeBilling}<Link href="/billing">maxvideoai.com</Link>{labels.afterBilling}</p>}
          <div className="hub-actions">
            {installUrl && <McpDirectoryInstallLink client="chatgpt" locale={locale} href={installUrl} className="mcp-button">
              <McpIntegrationMark integration="chatgpt" size={17} className="h-[17px] w-[17px]"/>{labels.install}<ArrowUpRight size={16} aria-hidden="true"/>
            </McpDirectoryInstallLink>}
            <Link href="#integrations" className={installUrl ? 'hub-link' : 'mcp-button'} data-analytics-event="cta_click" data-analytics-cta-name="mcp_choose_integration" data-analytics-cta-location="mcp_hero" data-analytics-target-family="mcp">
              {labels.guides}<ArrowDown size={15} aria-hidden="true"/>
            </Link>
          </div>
        </div>
        <McpHubDirectory locale={locale} publication={publication}/>
        {live && <figure className="hub-screenshot">
          <div className="hub-screenshot-label"><McpIntegrationMark integration="chatgpt" size={20} className="h-5 w-5"/>{labels.inside}</div>
          <a href={screenshot} aria-label={labels.capture}>
            <Image {...image} alt={labels.alt} loading="lazy" />
          </a>
          <figcaption><span>{labels.caption}</span><a href={screenshot}>{labels.capture} ↗</a></figcaption>
        </figure>}
      </div>
    </header>
  );
}
