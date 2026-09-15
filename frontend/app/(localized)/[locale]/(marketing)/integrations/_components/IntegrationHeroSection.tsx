import Link from 'next/link';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { McpIntegrationMark } from '@/components/marketing/mcp/McpIntegrationMark';
import { McpStoryVisual } from '@/components/marketing/mcp/McpStoryVisual.client';
import type { AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import type { IntegrationPageCopy } from '../_lib/integration-copy';
export function IntegrationHeroSection({copy,publication,locale}: {copy:IntegrationPageCopy;publication:McpPublicationState;locale:AppLocale}) {
 return <header className="mcp-hero mcp-integration-hero"><div className="container-page mcp-hero-grid"><div className="mcp-hero-copy"><div className="mcp-integration-signature"><McpIntegrationMark integration={copy.client} size={38} className="h-[38px] w-[38px]"/><span>×</span><span>MaxVideoAI</span></div><p className="mcp-eyebrow">{copy.hero.eyebrow}</p><h1>{copy.hero.title}</h1><p className="mcp-lead">{publication.connectionAvailable ? copy.hero.intro : copy.hero.accountStatus}</p><div className="mcp-actions"><Link href="#setup" className="mcp-button">{copy.hero.setupLabel}<ArrowDown size={16}/></Link><Link href={copy.hero.backHref} className="mcp-text-link">{copy.hero.backLabel}<ArrowUpRight size={16}/></Link></div><p className="mcp-integration-availability"><span aria-hidden="true"/>{publication.connectionAvailable ? copy.hero.liveStatus : copy.hero.unavailable}</p></div>{publication.showPaidGenerationClaim ? <McpStoryVisual locale={locale} client={copy.client} priority/> : null}</div></header>;
}
