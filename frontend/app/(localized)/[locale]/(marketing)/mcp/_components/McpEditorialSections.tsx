import Link from 'next/link';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { getMcpEditorialCopy } from '@/components/marketing/mcp/mcp-editorial-copy';
import { mcpHubCopy } from '@/components/marketing/mcp/mcp-hub-copy';
import type { McpHostProof } from '../_lib/mcp-host-proof';
import { McpHostProofCard } from './McpHostProofCard';

export function McpEditorialSections({ locale, hostProof }: {locale: AppLocale; hostProof: McpHostProof | null}) {
  const copy = getMcpEditorialCopy(locale);
  const labels = mcpHubCopy[locale];
  return <>
    <section id="setup" className="hub-how container-page">
      <div><h2>{labels.stepsTitle}</h2><p>{copy.workflowIntro}</p></div>
      <ol>{copy.stageTitles.map((title, index) => <li key={title}><h3>{title}</h3><p>{copy.stageBodies[index]}</p></li>)}</ol>
    </section>
    {hostProof && <section className="container-page hub-claude-evidence">
      <details><summary>{copy.proofTitle}</summary>
        <div id="real-result"><div><p>{copy.proofBody}</p><Link href={localizePathFromEnglish(locale, '/integrations/claude')}>{copy.guide} · Claude ↗</Link></div>
          <McpHostProofCard proof={hostProof}/></div>
      </details>
    </section>}
  </>;
}
