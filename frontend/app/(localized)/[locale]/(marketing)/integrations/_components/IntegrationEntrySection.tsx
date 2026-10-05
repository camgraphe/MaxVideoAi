import type { AppLocale } from '@/i18n/locales';
import type { McpClientId } from '../../mcp/_lib/mcp-page-types';
import { getIntegrationEntryCopy } from '../_content/entry';

export function IntegrationEntrySection({ locale, client }: { locale: AppLocale; client: McpClientId }) {
  const copy = getIntegrationEntryCopy(locale, client);
  if (!copy) return null;
  return <section className="mcp-entry mcp-section" data-integration-entry={client} aria-labelledby="integration-entry-title">
    <div className="container-page">
      <p className="mcp-eyebrow">{copy.eyebrow}</p>
      <h2 id="integration-entry-title">{copy.title}</h2>
      <ol className="mcp-entry-steps">{copy.steps.map((step, index) => <li key={step.title}>
        <span>0{index + 1}</span><h3>{step.title}</h3><p>{step.body}</p>
      </li>)}</ol>
      <p className="mcp-entry-scope">{copy.scope}</p>
    </div>
  </section>;
}
