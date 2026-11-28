import Image from 'next/image';
import { PublicVideoPlayer } from '@/components/media/PublicVideoPlayer.client';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { McpHostProofCard } from '../../mcp/_components/McpHostProofCard';
import type { McpHostProof } from '../../mcp/_lib/mcp-host-proof';
import { guideLabels, guideMediaPath, guideText, type GuideHost } from '../_content/guide-presentation';

const additionalMedia = {
  codex: { image: 'codex-project-draft.webp', width: 1840, height: 565, href: `${guideMediaPath}/eclipse-shot-list.md` },
  openclaw: { image: 'control-chat.webp', width: 1976, height: 1160, href: 'https://docs.openclaw.ai/cli/mcp/transports' },
  n8n: { image: 'n8n-template-mcp-parameters.webp', width: 844, height: 1045, href: `${guideMediaPath}/n8n-brief-to-approved-generation.json` },
};

export function IntegrationResultSection({ host, locale, proof }: {host: GuideHost; locale: AppLocale; proof: McpHostProof | null}) {
  const text = guideText[locale][host];
  const label = guideLabels[locale];
  const asset = host === 'chatgpt' || host === 'claude' ? null : additionalMedia[host];
  const href = asset?.href ?? (host === 'chatgpt' ? `${guideMediaPath}/atelier-chatgpt-subtitle-request.webp` : 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp');
  if (host === 'claude' && !proof) return null;
  return <section className="guide-result" id="real-result">
    <div className="container-page guide-split">
      <div><h2>{text.proofTitle}</h2><p>{text.proofBody}</p>
        <a className="guide-text-link" href={href}>{text.proofLink} ↗</a>
        <div className="guide-resources"><a href={localizePathFromEnglish(locale,'/examples')}>{label.examples}</a><a href={localizePathFromEnglish(locale,'/ai-video-engines')}>{label.compare}</a></div>
      </div>
      {host === 'chatgpt' ? <div className="guide-chatgpt-recording">
        <PublicVideoPlayer src={`${guideMediaPath}/atelier-chatgpt-window.mp4`} poster={`${guideMediaPath}/atelier-chatgpt-window-poster.webp`} title={text.proofTitle} locale={locale} deferPoster>
          <track kind="captions" src={`${guideMediaPath}/atelier.vtt`} label="English" srcLang="en"/>
        </PublicVideoPlayer>
      </div> : host === 'claude' && proof ? <McpHostProofCard proof={proof}/> : asset && <a className="guide-result-image" href={`${guideMediaPath}/${asset.image}`}>
        <Image src={`${guideMediaPath}/${asset.image}`} width={asset.width} height={asset.height} sizes="(min-width: 900px) 55vw, 92vw" loading="lazy" alt={text.proofBody}/>
      </a>}
    </div>
  </section>;
}
