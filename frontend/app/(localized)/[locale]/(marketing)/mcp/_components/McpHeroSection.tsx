import Link from 'next/link';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { getMcpEditorialCopy } from '@/components/marketing/mcp/mcp-editorial-copy';
import { McpStoryVisual } from '@/components/marketing/mcp/McpStoryVisual.client';
import type { McpPageCopy } from '../_lib/mcp-page-types';
export function McpHeroSection({locale, publication, copy, hasProof}: {locale:AppLocale; publication:McpPublicationState; copy:McpPageCopy; hasProof:boolean}) {
  const editorial = getMcpEditorialCopy(locale);
  return <header className="mcp-hero"><div className="container-page mcp-hero-grid"><div className="mcp-hero-copy"><p className="mcp-eyebrow">{editorial.eyebrow}</p><h1>{editorial.title}</h1><p className="mcp-lead">{publication.connectionAvailable && publication.showPaidGenerationClaim ? editorial.intro : copy.hero.previewIntro}</p><div className="mcp-actions"><Link href="#integrations" className="mcp-button">{editorial.choose}<ArrowDown size={17} aria-hidden="true" /></Link>{hasProof ? <Link href="#real-result" className="mcp-text-link">{editorial.proofLink}<ArrowUpRight size={16} aria-hidden="true" /></Link> : null}</div>{publication.showPaidGenerationClaim ? <p className="mcp-hero-note">{editorial.note}</p> : null}</div>{publication.showPaidGenerationClaim ? <McpStoryVisual locale={locale} priority /> : null}</div></header>;
}
