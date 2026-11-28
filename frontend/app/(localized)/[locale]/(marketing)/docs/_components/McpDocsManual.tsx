import { CopyPromptButton } from '@/components/CopyPromptButton';
import type { AppLocale } from '@/i18n/locales';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import { getMcpManualSections } from '../_lib/mcp-manual-sections';
import './mcp-docs-manual.css';

const labels = {
  en: { nav: 'On this page', copy: 'Copy server address', copied: 'Copied' },
  fr: { nav: 'Sur cette page', copy: 'Copier l’adresse du serveur', copied: 'Adresse copiée' },
  es: { nav: 'En esta página', copy: 'Copiar dirección del servidor', copied: 'Dirección copiada' },
};

export function McpDocsManual({ html, locale }: { html: string; locale: AppLocale }) {
  const sections = getMcpManualSections(html, locale);
  const copy = labels[locale];
  return (
    <div className="mcp-manual-layout">
      <nav className="mcp-manual-nav" aria-label={copy.nav}>
        <strong>{copy.nav}</strong>
        <ul>{sections.filter(section => section.navLabel).map(section => (
          <li key={section.id}><a href={`#${section.id}`}>{section.navLabel}</a></li>
        ))}</ul>
      </nav>
      <div className="mcp-manual-chapters">
        {sections.map((section, order) => (
          <section id={section.id} key={section.id ?? order} className="mcp-manual-chapter">
            <div className="public-prose prose" dangerouslySetInnerHTML={{ __html: section.html }} />
            {section.id === 'endpoint' && (
              <CopyPromptButton prompt={MCP_PRODUCTION_RESOURCE_URL} copyLabel={copy.copy} copiedLabel={copy.copied} />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
