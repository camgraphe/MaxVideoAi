import Image from 'next/image';
import Link from 'next/link';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import type { AppLocale } from '@/i18n/locales';
import { mcpHubCopy } from '@/components/marketing/mcp/mcp-hub-copy';
import { McpExamplePreview } from './McpExamplePreview.client';

const media = [
  {kind: 'video', cover: 'lamp.webp', src: 'lamp.mp4', captions: 'lamp.vtt'},
  {kind: 'image', cover: 'pigment.webp', src: 'pigment.webp'},
  {kind: 'audio', cover: 'rain.webp', src: 'rain.wav'},
  {kind: 'guide', cover: 'atelier-captions.webp'},
] as const;
const base = '/media/mcp/hub-redesign/';

export function McpHubGallery({ locale }: {locale: AppLocale}) {
  const copy = mcpHubCopy[locale];
  return <section className="hub-gallery">
    <div className="container-page">
      <h2>{copy.gallery}</h2><p className="hub-gallery-intro">{copy.intro}</p>
      <div className="hub-example-grid">
        {media.map((item, i) => {
          const [kind, title, prompt, action, alt] = copy.examples[i];
          const cover = base + item.cover;
          const content = <>
            <div className="hub-example-cover">
              <Image src={cover} alt={alt} width={480} height={270} sizes="(min-width:1280px) 290px, (min-width:760px) 23vw, 46vw" loading="lazy"/>
              <span>{action} {item.kind === 'audio' || item.kind === 'video' ? '▶' : '↗'}</span>
            </div>
            <div className="hub-example-copy"><small>{kind}</small><h3>{title}</h3><p>“{prompt}”</p></div>
          </>;
          return <article className="hub-example" key={item.kind}>
            {item.kind === 'guide'
              ? <Link href={localizePathFromEnglish(locale, '/integrations/chatgpt') + '#real-result'}>{content}</Link>
              : <McpExamplePreview kind={item.kind} src={base + item.src} poster={cover} captions={item.kind === 'video' ? base + item.captions : undefined} title={title} alt={alt} close={copy.close}>{content}</McpExamplePreview>}
          </article>;
        })}
      </div>
      <div className="hub-resource-links"><Link href={localizePathFromEnglish(locale, '/examples')}>{copy.more} →</Link><Link href={localizePathFromEnglish(locale, '/ai-video-engines')}>{copy.compare} →</Link></div>
    </div>
  </section>;
}
