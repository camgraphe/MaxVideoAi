import type { AppLocale } from '@/i18n/locales';
import { AssistantJourney } from '@/components/marketing/AssistantJourney.client';
import { ASSISTANT_JOURNEY_COPY } from '@/components/marketing/assistant-journey-copy';

const COPY = {
 en:{eyebrow:'From your project to your video',title:'Keep creating. Keep the context.',body:'Develop a scene from the project you are already working on. Your references, the model choice and the price stay part of the same conversation.'},
 fr:{eyebrow:'De votre projet à votre vidéo',title:'Continuez à créer. Gardez le contexte.',body:'Préparez une scène à partir du projet sur lequel vous travaillez déjà. Vos références, le choix du modèle et le prix restent dans la même conversation.'},
 es:{eyebrow:'De tu proyecto a tu video',title:'Sigue creando. Conserva el contexto.',body:'Prepara una escena a partir del proyecto en el que ya estás trabajando. Tus referencias, el modelo y el precio forman parte de la misma conversación.'},
};

/** The rejected watch/scroll mockup is deliberately no longer rendered. */
export function McpProjectDemo({locale}:{locale:AppLocale}) {
 const copy=COPY[locale];
 return <section id="project-flow" className="connect-project-flow section"><div className="container-page editorial-split">
  <div><p className="editorial-eyebrow">{copy.eyebrow}</p><h2 className="editorial-heading">{copy.title}</h2><p className="editorial-body">{copy.body}</p></div>
  <AssistantJourney {...ASSISTANT_JOURNEY_COPY[locale]}/>
 </div></section>;
}
