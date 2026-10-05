import Link from 'next/link';
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
    ? { title: 'Connexions MCP', detail: 'Utilisez MaxVideoAI depuis votre assistant ou vos automatisations.', connect: 'Voir la connexion MCP', all: 'Toutes les intégrations MCP', close: 'Fermer', newTab: 'nouvel onglet' }
    : locale === 'es'
      ? { title: 'Conexiones MCP', detail: 'Usa MaxVideoAI desde tu asistente o tus automatizaciones.', connect: 'Ver la conexión MCP', all: 'Todas las integraciones MCP', close: 'Cerrar', newTab: 'pestaña nueva' }
      : { title: 'MCP connections', detail: 'Use MaxVideoAI from your assistant or automations.', connect: 'View MCP connection', all: 'All MCP integrations', close: 'Close', newTab: 'new tab' };
}

export function AppAssistantConnections({ locale, onNavigate, showTitle = true }: { locale: Locale; onNavigate: () => void; showTitle?: boolean }) {
  const copy = getAppMcpCopy(locale);
  if (!appMcpIntegrations.length) return null;
  return <section className="app-assistant-connections" aria-label={copy.title}>
    {showTitle ? <h3>{copy.title}</h3> : null}<p>{copy.detail}</p>
    <div className="app-assistant-options">{appMcpIntegrations.map((integration) => <Link key={integration.id} href={getPathname({ locale, href: integration.href })} target="_blank" rel="noopener noreferrer" prefetch={false} onClick={onNavigate}>
      <McpIntegrationMark integration={integration.id} /><span><strong>{integration.name}</strong><small>{copy.connect}</small></span><span className="sr-only"> ({copy.newTab})</span>
    </Link>)}</div>
    <div className="app-assistant-more">
      <Link href={getPathname({ locale, href: '/mcp' })} target="_blank" rel="noopener noreferrer" prefetch={false} onClick={onNavigate}>{copy.all} <AppGlyph name="external" /><span className="sr-only"> ({copy.newTab})</span></Link>
    </div>
  </section>;
}
