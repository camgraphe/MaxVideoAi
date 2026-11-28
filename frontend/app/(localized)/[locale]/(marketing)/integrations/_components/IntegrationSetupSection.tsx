import Image from 'next/image';
import { Plus, ShieldCheck } from 'lucide-react';
import { getMcpEditorialCopy } from '@/components/marketing/mcp/mcp-editorial-copy';
import { MAXVIDEOAI_PUBLIC_PLUGIN_SOURCE_TAG } from '@/config/maxvideoai-plugin-release';
import type { AppLocale } from '@/i18n/locales';
import { getMcpIntegration } from '@/lib/mcp-integration-registry';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import { formatMcpCheckpointDate, type McpCompatibilityClientEvidence } from '../../mcp/_lib/mcp-compatibility';
import type { IntegrationPageCopy } from '../_lib/integration-copy';
import { IntegrationInstallCopy } from './IntegrationInstallCopy.client';

const setupLabels = {
  en: {
    advanced: 'Advanced setup',
    chatgpt: 'Use this option if your workspace needs a custom server configuration.',
    codex: 'Use these commands to install the plugin in a standalone terminal.',
    release: 'Codex CLI package',
    openclaw: 'View the MaxVideoAI skill on ClawHub',
  },
  fr: {
    advanced: 'Configuration avancée',
    chatgpt: 'Cette option permet de configurer un serveur personnalisé pour votre espace de travail.',
    codex: 'Utilisez ces commandes pour installer le plugin dans un terminal indépendant.',
    release: 'Paquet pour Codex CLI',
    openclaw: 'Voir le skill MaxVideoAI sur ClawHub',
  },
  es: {
    advanced: 'Configuración avanzada',
    chatgpt: 'Usa esta opción si tu espacio de trabajo necesita un servidor personalizado.',
    codex: 'Usa estos comandos para instalar el plugin en una terminal independiente.',
    release: 'Paquete para Codex CLI',
    openclaw: 'Ver el skill MaxVideoAI en ClawHub',
  },
};

export function IntegrationSetupSection({ compatibility, copy, locale, advanced = false }: {
  compatibility: McpCompatibilityClientEvidence;
  copy: IntegrationPageCopy;
  locale: AppLocale;
  advanced?: boolean;
}) {
  const editorial = getMcpEditorialCopy(locale);
  const labels = setupLabels[locale];
  const integration = getMcpIntegration(copy.client);
  const nativePlugin = copy.client === 'chatgpt' || copy.client === 'codex';
  const heading = advanced && nativePlugin ? copy.setup.hostGuides[0].title : copy.setup.title;
  const intro = advanced && nativePlugin ? labels[copy.client === 'codex' ? 'codex' : 'chatgpt'] : copy.setup.intro;

  return (
    <section id={advanced ? 'advanced-setup' : 'setup'} className="mcp-setup mcp-section">
      <div className="container-page">
        <div className="mcp-section-heading">
          <div><p className="mcp-eyebrow">{advanced ? labels.advanced : copy.setup.eyebrow}</p><h2>{heading}</h2></div>
          <p>{intro}</p>
        </div>
        <div className="mcp-setup-grid">
          <div>
            {copy.setup.hostGuides.map((guide, index) => {
              const evidence = compatibility.hosts.find(host => host.id === guide.hostId);
              if (!evidence) return null;
              return (
                <details key={guide.hostId} className="mcp-host-guide" name="mcp-host-guide" open={!advanced && index === 0}>
                  <summary><span><small>{evidence.hostLabel}</small>{guide.title}</span><Plus size={20} /></summary>
                  <div className="mcp-host-guide-body">
                    <p>{guide.intro}</p>
                    {copy.client === 'openclaw' && integration.store.status === 'listed' && (
                      <a className="mcp-text-link" href="https://clawhub.ai/camgraphe/skills/maxvideoai" target="_blank" rel="noreferrer">{labels.openclaw} ↗</a>
                    )}
                    <ol className="mcp-setup-steps">
                      {guide.steps.map((step, i) => (
                        <li key={step.title}>
                          <span className="mcp-step-index">0{i + 1}</span>
                          <div>
                            <h3>{step.title}</h3><p>{step.body}</p>
                            {step.proof && (
                              <figure>
                                <Image src={step.proof.src} alt={step.proof.alt} width={576} height={384} sizes="(min-width: 1024px) 45vw, 90vw" loading="lazy" className="h-auto w-full" />
                                <figcaption>{step.proof.caption}</figcaption>
                              </figure>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                    {guide.setupValues.length > 0 && (
                      <dl className="mcp-setup-values">
                        {guide.setupValues.map(item => <div key={item.label}><dt>{item.label}</dt><dd><code>{item.value}</code></dd></div>)}
                      </dl>
                    )}
                    {guide.commands.length > 0 && (
                      <div className="mcp-commands">
                        <p>{guide.commandLabel}</p>
                        {guide.commands.map(command => <pre key={command}><code>{command}</code></pre>)}
                        {guide.hostId === 'codexCli' && integration.installation.package === 'available' && (
                          <a className="mcp-text-link" href={`https://github.com/camgraphe/maxvideoai-plugin/releases/tag/${MAXVIDEOAI_PUBLIC_PLUGIN_SOURCE_TAG}`}>
                            {labels.release} {MAXVIDEOAI_PUBLIC_PLUGIN_SOURCE_TAG} ↗
                          </a>
                        )}
                      </div>
                    )}
                    <IntegrationInstallCopy copy={copy.setup.installAction} instruction={guide.installInstruction} resourceUrl={MCP_PRODUCTION_RESOURCE_URL} />
                    {guide.authTrigger && <p className="mcp-host-limitation">{guide.authTrigger}</p>}
                    <p className="mcp-host-limitation">{guide.limitation}</p>
                    <details className="mcp-evidence-details">
                      <summary>{editorial.verified}<Plus size={16} /></summary>
                      <p>{copy.compatibility.statuses[guide.hostId]}</p>
                      <p>{copy.compatibility.checkpointLabel}: {formatMcpCheckpointDate(locale, evidence.lastChecked)}</p>
                      <p>{copy.compatibility.machineStatusLabel}: <code>{evidence.status}</code></p>
                    </details>
                  </div>
                </details>
              );
            })}
          </div>
          <aside className="mcp-authorization">
            <ShieldCheck size={29} strokeWidth={1.4} />
            <p className="mcp-eyebrow">{editorial.account}</p>
            <h3>{copy.setup.oauthTitle}</h3><p>{copy.setup.oauthBody}</p>
            <ol>{copy.setup.oauthSteps.map((step, index) => <li key={step}><span>0{index + 1}</span>{step}</li>)}</ol>
            <div className="mcp-account-path"><span>{copy.clientLabel}</span><span>→</span><strong>maxvideoai.com</strong></div>
          </aside>
        </div>
      </div>
    </section>
  );
}
