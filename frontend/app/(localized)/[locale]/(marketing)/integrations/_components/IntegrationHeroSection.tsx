import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { McpDirectoryInstallLink } from '@/components/marketing/mcp/McpDirectoryInstallLink.client';
import { McpIntegrationMark } from '@/components/marketing/mcp/McpIntegrationMark';
import type { AppLocale } from '@/i18n/locales';
import { getMcpClientActionConfig, getMcpIntegration } from '@/lib/mcp-integration-registry';
import { MCP_N8N_PUBLIC_TEMPLATE_URL } from '@/lib/mcp-n8n-template';
import type { McpPublicationState } from '@/lib/mcp-publication';
import type { IntegrationPageCopy } from '../_lib/integration-copy';
import { guideLabels, guideMedia, guideMediaPath, guideText, type GuideHost } from '../_content/guide-presentation';
import { IntegrationGuideAccount } from './IntegrationGuideAccount';

const hostDestinations = {
  claude: 'https://claude.ai/customize/connectors',
  openclaw: 'https://clawhub.ai/camgraphe/skills/maxvideoai',
  n8n: MCP_N8N_PUBLIC_TEMPLATE_URL,
};

export function IntegrationHeroSection({ copy, publication, locale, host }: {
  copy: IntegrationPageCopy; publication: McpPublicationState; locale: AppLocale; host: GuideHost;
}) {
  const live = publication.connectionAvailable;
  const label = guideLabels[locale];
  const text = guideText[locale][host];
  const capture = guideMedia[host];
  const directory = getMcpClientActionConfig('chatgpt');
  const directoryHost = host === 'chatgpt' || host === 'codex';
  const listing = live && directoryHost && directory.deepLinkEnabled ? directory.deepLink : null;
  const showGuide = !live || directoryHost || (host !== 'claude' && getMcpIntegration(host).store.status !== 'listed');
  const destination = showGuide || directoryHost ? '#setup' : hostDestinations[host];

  return <header className="guide-opening">
    <div className="container-page">
      <nav className="guide-crumb" aria-label={label.hub}><Link href={copy.hero.backHref}>{label.hub}</Link><span aria-hidden="true">/</span><span>{copy.clientLabel}</span></nav>
      <div className="guide-opening-grid">
        <div className="guide-intro">
          <div className="guide-identity">{host === 'codex'
            ? <Image src={`${guideMediaPath}/codex.png`} width={36} height={36} alt="" aria-hidden="true" />
            : <McpIntegrationMark integration={host} size={36} className="h-9 w-9" />}
            <span>{text.kind}</span></div>
          <h1>{copy.hero.title}</h1>
          <p className="guide-lede">{live ? copy.hero.intro : copy.hero.accountStatus}</p>
          <div className="guide-actions">{listing && directoryHost
            ? <McpDirectoryInstallLink href={listing} client={host} locale={locale} className="mcp-button">{text.action}<ArrowUpRight size={16} aria-hidden="true"/></McpDirectoryInstallLink>
            : <a href={destination} className="mcp-button" data-analytics-event="cta_click" data-analytics-cta-name="mcp_setup_guide" data-analytics-cta-location="integration_hero" data-analytics-target-family="mcp">{showGuide ? label.link : text.action}<ArrowUpRight size={16} aria-hidden="true"/></a>}
            {live && (publication.showPaidGenerationClaim
              ? <a href="#first-video" className="guide-text-link">{host === 'n8n' ? label.workflow : label.first} →</a>
              : <a href={listing && host === 'codex' ? '#advanced-setup' : '#setup'} className="guide-text-link">{listing && host === 'codex' ? label.setupCli : label.link} →</a>)}
          </div>
          {live && <IntegrationGuideAccount locale={locale} plugin={directoryHost} />}
        </div>
        <figure className="guide-native-capture">
          <a href={`${guideMediaPath}/${capture.image}`}>
            {host === 'n8n'
              ? <picture><source media="(max-width: 640px)" srcSet={`${guideMediaPath}/n8n-template-canvas-mobile.webp`} width={907} height={478}/>
                <Image src={`${guideMediaPath}/${capture.image}`} width={capture.width} height={capture.height} alt={text.caption} loading="eager" unoptimized /></picture>
              : <Image src={`${guideMediaPath}/${capture.image}`} width={capture.width} height={capture.height} alt={text.caption} priority fetchPriority={host === 'chatgpt' ? 'high' : undefined} sizes="(min-width: 1280px) 680px, (min-width: 851px) 54vw, 92vw"/>}
          </a>
          <figcaption><span>{text.caption}</span><a href={`${guideMediaPath}/${capture.image}`}>{label.enlarge} ↗</a></figcaption>
        </figure>
      </div>
    </div>
  </header>;
}
