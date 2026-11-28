import type { AppLocale } from '@/i18n/locales';
import { McpDirectoryInstallLink } from '@/components/marketing/mcp/McpDirectoryInstallLink.client';
import { directoryCopy } from '../_content/directory';

export function IntegrationDirectorySetup({ client, href, locale, showPaidGeneration }: {
  client: 'chatgpt' | 'codex';
  href: string;
  locale: AppLocale;
  showPaidGeneration: boolean;
}) {
  const copy = directoryCopy[locale];
  const usePlugin = copy[client];
  return (
    <section id="setup" className="mcp-entry mcp-section" aria-labelledby="directory-setup-title">
      <div className="container-page">
        <h2 id="directory-setup-title">{copy.heading}</h2>
        <ol className="mcp-entry-steps">
          <li>
            <span aria-hidden="true">01</span>
            <h3><McpDirectoryInstallLink client={client} locale={locale} href={href} className="mcp-text-link">{copy.install} ↗</McpDirectoryInstallLink></h3>
            <p>{copy.installBody}</p>
          </li>
          <li><span aria-hidden="true">02</span><h3>{copy.account}</h3><p>{copy.accountBody}</p></li>
          <li><span aria-hidden="true">03</span><h3>{usePlugin.title}</h3><p>{usePlugin.body}{showPaidGeneration ? ` ${copy.approval}` : ''}</p></li>
        </ol>
        <p className="mcp-entry-scope">{copy.availability}{' '}
          <a className="mcp-text-link" href="https://help.openai.com/en/articles/20001256-plugins-in-chatgpt">{copy.help} ↗</a>
        </p>
      </div>
    </section>
  );
}
