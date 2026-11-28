import '@/styles/marketing-mcp.css';
import '@/styles/marketing-mcp-hub.css';
import type { AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { McpTrustStrip } from '@/components/marketing/mcp/McpTrustStrip';
import { McpCreationStories } from '@/components/marketing/mcp/McpCreationStories';
import { AssistantFirstRequest } from '@/components/marketing/AssistantFirstRequest';
import type { McpCompatibilityEvidence } from '../_lib/mcp-compatibility';
import type { McpHostProof } from '../_lib/mcp-host-proof';
import type { McpPageCopy } from '../_lib/mcp-page-types';
import { McpHeroSection } from './McpHeroSection';
import { McpHubGallery } from './McpHubGallery';
import { McpFaqResourcesSection } from './McpFaqResourcesSection';
import { McpEditorialSections } from './McpEditorialSections';

export function McpPageView({ compatibility, copy, locale, hostProof = null, publication }: {
  compatibility: McpCompatibilityEvidence; copy: McpPageCopy; locale: AppLocale;
  hostProof?: McpHostProof | null; publication: McpPublicationState;
}) {
  const live = publication.connectionAvailable && publication.showPaidGenerationClaim;
  return <div className="mcp-redesign mcp-hub">
    <McpHeroSection locale={locale} publication={publication} copy={copy}/>
    {live ? <>
      <McpHubGallery locale={locale}/>
      <McpCreationStories locale={locale}/>
      <McpEditorialSections locale={locale} hostProof={hostProof}/>
      <AssistantFirstRequest locale={locale} proofHref={hostProof ? '#real-result' : undefined}
        prompt={{en:'Use MaxVideoAI to compare two models for animating my product photo.', fr:'Compare deux modèles avec MaxVideoAI pour animer ma photo de produit.', es:'Compara dos modelos con MaxVideoAI para animar mi foto de producto.'}[locale]}/>
      <McpTrustStrip locale={locale}/>
    </> : null}
    <McpFaqResourcesSection copy={copy} lastChecked={compatibility.lastChecked} locale={locale} publication={publication}/>
  </div>;
}
