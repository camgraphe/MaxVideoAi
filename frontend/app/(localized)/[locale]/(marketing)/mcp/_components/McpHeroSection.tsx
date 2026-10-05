import Link from 'next/link';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { getMcpEditorialCopy } from '@/components/marketing/mcp/mcp-editorial-copy';
import { McpStoryVisual } from '@/components/marketing/mcp/McpStoryVisual.client';
import type { McpPageCopy } from '../_lib/mcp-page-types';
import type { McpHostProof } from '../_lib/mcp-host-proof';
import { McpHostProofCard } from './McpHostProofCard';

export function McpHeroSection({ locale, publication, copy, hostProof }: {
  locale: AppLocale; publication: McpPublicationState; copy: McpPageCopy; hostProof: McpHostProof | null;
}) {
  const editorial = getMcpEditorialCopy(locale);
  const live = publication.connectionAvailable && publication.showPaidGenerationClaim;
  return <header className="mcp-hero"><div className="container-page mcp-hero-grid mcp-entry-hero-grid">
    <div className="mcp-hero-copy">
      <p className="mcp-eyebrow">{editorial.eyebrow}</p><h1>{editorial.title}</h1>
      <p className="mcp-lead">{live ? editorial.intro : copy.hero.previewIntro}</p>
      <div className="mcp-actions">
        <Link href="#integrations" className="mcp-button" data-analytics-event="cta_click" data-analytics-cta-name="mcp_choose_integration" data-analytics-cta-location="mcp_hero" data-analytics-target-family="mcp">{editorial.choose}<ArrowDown size={17} aria-hidden="true" /></Link>
      </div>
    </div>
    {live && hostProof ? <div className="mcp-hero-proof" id="real-result"><McpHostProofCard proof={hostProof} priority /></div>
      : publication.showPaidGenerationClaim ? <div className="mcp-hero-visual"><McpStoryVisual locale={locale} priority /></div> : null}
    <div className="mcp-entry-hero-notes">
      {live && hostProof ? <Link href="#real-result" className="mcp-text-link">{editorial.proofLink}<ArrowUpRight size={16} aria-hidden="true" /></Link> : null}
      {publication.showPaidGenerationClaim ? <p className="mcp-hero-note">{editorial.note}</p> : null}
    </div>
  </div></header>;
}
