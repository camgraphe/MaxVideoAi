import { CinematicArrow } from './ModelCinematicMarks';
import NextLink from 'next/link';
import { Sparkles } from 'lucide-react';
import type { ModelCinematicContent } from '../_lib/model-page-cinematic-content';
import { ModelCinematicTypedRequest } from './ModelCinematicTypedRequest.client';

/** Contextual prompt assistance opens the model composer, never Studio or an automatic generation. */
export function ModelCinematicPromptAssistant({ copy, href }: { copy: ModelCinematicContent['promptAssistant']; href: string }) {
  return <aside className="cinema-prompt-assistant">
    <NextLink href={href} prefetch={false} className="cinema-milo-bar" data-analytics-event="cta_click" data-analytics-cta-name="milo_try" data-analytics-cta-location="model_prompt_guide" data-analytics-target-family="workspace" aria-label={`${copy.title} — ${copy.action}`}>
      <span className="cinema-milo-brand"><Sparkles size={21} aria-hidden="true" /><strong>Milo</strong></span>
      <ModelCinematicTypedRequest text={copy.action} /><CinematicArrow />
    </NextLink>
    <p>{copy.body}</p>
  </aside>;
}
