import { CopyPromptButton } from '@/components/CopyPromptButton';
import type { AppLocale } from '@/i18n/locales';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import { guideLabels } from '../_content/guide-presentation';
import { directSetupLabels, directSetupSteps, type DirectHost } from '../_content/guide-setup';

export function IntegrationConnectorSetup({ host, locale, commands }: {
  host: DirectHost;
  locale: AppLocale;
  commands: string[];
}) {
  const labels = directSetupLabels[locale];
  const snippet = host === 'openclaw' ? commands.join('\n') : MCP_PRODUCTION_RESOURCE_URL;
  return (
    <section id="setup" className="mcp-entry mcp-section" aria-labelledby="connector-setup-title">
      <div className="container-page">
        <h2 id="connector-setup-title">{labels.title}</h2>
        <ol className="mcp-entry-steps">
          {directSetupSteps[locale][host].map(([title, body], index) => (
            <li key={title}><span aria-hidden="true">0{index + 1}</span><h3>{title}</h3><p>{body}</p></li>
          ))}
        </ol>
        <div className="guide-config">
          <pre><code>{snippet}</code></pre>
          <CopyPromptButton prompt={snippet} copyLabel={host === 'openclaw' ? labels.copyCommands : labels.copyAddress} copiedLabel={guideLabels[locale].copied} />
        </div>
        <a className="guide-text-link" href="#advanced-setup">{labels.advanced} ↓</a>
      </div>
    </section>
  );
}
