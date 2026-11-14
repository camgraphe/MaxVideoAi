import NextLink from 'next/link';
import type { ModelCinematicContent } from '../_lib/model-page-cinematic-content';

/** Contextual prompt assistance opens the model composer, never Studio or an automatic generation. */
export function ModelCinematicPromptAssistant({ copy, href }: { copy: ModelCinematicContent['promptAssistant']; href: string }) {
  return <aside className="cinema-prompt-assistant">
    <div><h3>{copy.title}</h3><p>{copy.body}</p></div>
    <NextLink href={href} prefetch={false} className="cinema-button">{copy.action}<span aria-hidden="true">↗</span></NextLink>
  </aside>;
}
