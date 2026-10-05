import Link from 'next/link';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { McpIntegrationMark } from '@/components/marketing/mcp/McpIntegrationMark';
import { McpStoryVisual } from '@/components/marketing/mcp/McpStoryVisual.client';
import type { AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { McpHostProofCard } from '../../mcp/_components/McpHostProofCard';
import type { McpHostProof } from '../../mcp/_lib/mcp-host-proof';
import { getIntegrationEntryCopy } from '../_content/entry';
import type { IntegrationPageCopy } from '../_lib/integration-copy';

export function IntegrationHeroSection({ copy, publication, locale, hostProof }: {
  copy: IntegrationPageCopy; publication: McpPublicationState; locale: AppLocale; hostProof: McpHostProof | null;
}) {
  const live = publication.connectionAvailable && publication.showPaidGenerationClaim;
  const entry = getIntegrationEntryCopy(locale, copy.client);
  return <header className="mcp-hero mcp-integration-hero">
    <div className="container-page mcp-hero-grid mcp-entry-hero-grid">
      <div className="mcp-hero-copy">
        <div className="mcp-integration-signature"><McpIntegrationMark integration={copy.client} size={38} className="h-[38px] w-[38px]" /><span>×</span><span>MaxVideoAI</span></div>
        <p className="mcp-eyebrow">{copy.hero.eyebrow}</p>
        <h1>{copy.hero.title}</h1>
        <p className="mcp-lead">{publication.connectionAvailable ? copy.hero.intro : copy.hero.accountStatus}</p>
        <div className="mcp-actions">
          <Link href="#setup" className="mcp-button" data-analytics-event="cta_click" data-analytics-cta-name="mcp_setup_guide" data-analytics-cta-location="integration_hero" data-analytics-target-family="mcp">{copy.hero.setupLabel}<ArrowDown size={16} aria-hidden="true" /></Link>
        </div>
      </div>
      {live && hostProof && copy.client === 'claude' ? <div className="mcp-hero-proof" id="real-result"><McpHostProofCard proof={hostProof} priority /></div>
        : publication.showPaidGenerationClaim ? <div className="mcp-hero-visual"><McpStoryVisual locale={locale} client={copy.client} priority /></div> : null}
      <div className="mcp-entry-hero-notes">
        <Link href={copy.hero.backHref} className="mcp-text-link">{copy.hero.backLabel}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        {live && entry ? <p className="mcp-hero-cost">{entry.cost}</p> : null}
        <p className="mcp-integration-availability"><span aria-hidden="true" />{publication.connectionAvailable ? copy.hero.liveStatus : copy.hero.unavailable}</p>
      </div>
    </div>
  </header>;
}
