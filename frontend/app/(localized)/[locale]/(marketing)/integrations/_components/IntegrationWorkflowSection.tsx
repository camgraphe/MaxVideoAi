import { CopyPromptButton } from '@/components/CopyPromptButton';
import type { AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import type { IntegrationPageCopy } from '../_lib/integration-copy';
import { guideLabels, guideText, type GuideHost } from '../_content/guide-presentation';

export function IntegrationWorkflowSection({ copy, host, locale, publication }: {
  copy: IntegrationPageCopy; host: GuideHost; locale: AppLocale; publication: McpPublicationState;
}) {
  const label = guideLabels[locale];
  const text = guideText[locale][host];
  const live = publication.connectionAvailable && publication.showPaidGenerationClaim;
  return <section className="mcp-integration-workflow guide-prompt" id="first-video">
    <div className="container-page guide-split">
      <div><h2>{live ? (host === 'n8n' ? label.workflow : label.first) : copy.workflow.title}</h2>
        <p>{live ? text.follow : copy.references.gatedBody}</p>{live && <p>{label.price}</p>}</div>
      {live
        ? <div className="guide-prompt-card"><strong>{copy.clientLabel}</strong><blockquote>{text.prompt}</blockquote><CopyPromptButton prompt={text.prompt} copyLabel={label.copy} copiedLabel={label.copied}/></div>
        : <ol>{copy.workflow.previewSteps.map(step => <li key={step.title}><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>}
    </div>
  </section>;
}
