import NextLink from 'next/link';
import type { AppLocale } from '@/i18n/locales';
import type { ModelCinematicContent } from '../_lib/model-page-cinematic-content';

/** Contextual prompt assistance opens the model composer, never Studio or an automatic generation. */
export function ModelCinematicPromptAssistant({ content, locale }: { content: ModelCinematicContent; locale: AppLocale }) {
  const copy = content.promptAssistant;
  const base = content.variant === 'image' ? '/app/image' : '/app';
  const href = `${base}?engine=${encodeURIComponent(content.modelSlug)}${content.variant === 'video' ? '&mode=t2v' : ''}&assistant=milo&lang=${locale}`;
  return <aside className="cinema-prompt-assistant">
    <div><h3>{copy.title}</h3><p>{copy.body}</p></div>
    <NextLink href={href} prefetch={false} className="cinema-button">{copy.action}<span aria-hidden="true">↗</span></NextLink>
  </aside>;
}
