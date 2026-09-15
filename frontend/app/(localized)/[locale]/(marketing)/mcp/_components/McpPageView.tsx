import type { AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { McpIntegrationCards } from '@/components/marketing/mcp/McpIntegrationCards';
import { McpTrustStrip } from '@/components/marketing/mcp/McpTrustStrip';
import { AssistantFirstRequest } from '@/components/marketing/AssistantFirstRequest';
import type { McpCompatibilityEvidence } from '../_lib/mcp-compatibility';
import type { McpHostProof } from '../_lib/mcp-host-proof';
import type { McpPageCopy } from '../_lib/mcp-page-types';
import { McpHeroSection } from './McpHeroSection';
import { McpFaqResourcesSection } from './McpFaqResourcesSection';
import { McpEditorialSections } from './McpEditorialSections';
export function McpPageView({compatibility,copy,locale,hostProof=null,publication}: {compatibility:McpCompatibilityEvidence;copy:McpPageCopy;locale:AppLocale;hostProof?:McpHostProof|null;publication:McpPublicationState}) {
 const live=publication.connectionAvailable&&publication.showPaidGenerationClaim;
 return <div className="mcp-redesign"><McpHeroSection locale={locale} publication={publication} copy={copy} hasProof={live&&!!hostProof}/><McpIntegrationCards locale={locale}/>{live?<><McpEditorialSections locale={locale} hostProof={hostProof}/><McpTrustStrip locale={locale}/><AssistantFirstRequest locale={locale}/></>:null}<McpFaqResourcesSection copy={copy} lastChecked={compatibility.lastChecked} locale={locale} publication={publication}/></div>;
}
