import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { getPathname } from '@/i18n/navigation';
import mcpPublication from '@/config/mcp-publication.json';
import { McpIntegrationMark } from '@/components/marketing/mcp/McpIntegrationMark';
import { getMcpIntegration, getMcpPublicIntegrationIds } from '@/lib/mcp-integration-registry';
import { getMcpPublicationState, type McpPublicationState } from '@/lib/mcp-publication';
import type { Locale } from '@/lib/i18n/types';
import { AppGlyph } from './AppGlyph';

type IntegrationHref = Extract<Parameters<typeof getPathname>[0]['href'], `/integrations/${string}`>;

export function getAppMcpIntegrations(publication: McpPublicationState = getMcpPublicationState(mcpPublication)) {
  return publication.renderPublicPage && publication.indexable
    ? getMcpPublicIntegrationIds().map(id => ({ id, name: getMcpIntegration(id).label, href: getMcpIntegration(id).englishPath as IntegrationHref }))
    : [];
}

export const appMcpIntegrations = getAppMcpIntegrations();

export function getAppMcpCopy(locale: Locale) {
  return locale === 'fr'
    ? { title: 'Connexions MCP', detail: 'Utilisez MaxVideoAI depuis votre assistant ou vos automatisations.', connect: 'Voir la connexion MCP', all: 'Toutes les intégrations MCP', close: 'Fermer', newTab: 'nouvel onglet', compactTitle: 'Connectez votre assistant', compactDetail: 'Utilisez MaxVideoAI depuis vos outils.', compactAll: 'Toutes les intégrations' }
    : locale === 'es'
      ? { title: 'Conexiones MCP', detail: 'Usa MaxVideoAI desde tu asistente o tus automatizaciones.', connect: 'Ver la conexión MCP', all: 'Todas las integraciones MCP', close: 'Cerrar', newTab: 'pestaña nueva', compactTitle: 'Conecta tu asistente', compactDetail: 'Usa MaxVideoAI desde tus herramientas.', compactAll: 'Todas las integraciones' }
      : { title: 'MCP connections', detail: 'Use MaxVideoAI from your assistant or automations.', connect: 'View MCP connection', all: 'All MCP integrations', close: 'Close', newTab: 'new tab', compactTitle: 'Connect your assistant', compactDetail: 'Use MaxVideoAI from your tools.', compactAll: 'All integrations' };
}

export function AppAssistantConnections({ locale, onNavigate, showTitle = true, compact = false, titleId }: { locale: Locale; onNavigate: () => void; showTitle?: boolean; compact?: boolean; titleId?: string }) {
  const copy = getAppMcpCopy(locale);
  if (!appMcpIntegrations.length) return null;
  return <section className={`app-assistant-connections${compact ? ' app-assistant-connections-compact' : ''}`} aria-label={compact ? copy.compactTitle : copy.title}>
    {showTitle ? <h3 id={titleId}>{compact ? copy.compactTitle : copy.title}</h3> : null}<p>{compact ? copy.compactDetail : copy.detail}</p>
    <div className="app-assistant-options">{appMcpIntegrations.map((integration) => <Link key={integration.id} href={getPathname({ locale, href: integration.href })} target="_blank" rel="noopener noreferrer" prefetch={false} onClick={onNavigate}>
      <McpIntegrationMark integration={integration.id} size={compact ? 20 : 24} className={compact ? 'h-5 w-5' : 'h-6 w-6'} /><span><strong>{integration.name}</strong>{compact ? null : <small>{copy.connect}</small>}</span>{compact ? <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" /> : null}<span className="sr-only"> ({copy.newTab})</span>
    </Link>)}</div>
    <div className="app-assistant-more">
      <Link href={getPathname({ locale, href: '/mcp' })} target="_blank" rel="noopener noreferrer" prefetch={false} onClick={onNavigate}>{compact ? copy.compactAll : copy.all} {compact ? <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" /> : <AppGlyph name="external" />}<span className="sr-only"> ({copy.newTab})</span></Link>
    </div>
  </section>;
}
