import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { WorkflowSeoSummaryCopy } from './home-redesign-types';

const COPY = {
 en:{title:'What are you starting with?',body:'A prompt, a still image or an existing clip: choose a workflow that fits your material.',cards:[['Text-to-video','Describe a scene. Explore videos and prompts.'],['Image-to-video','Animate a still image with a compatible model.'],['Video-to-video','Check which models accept existing clips.']]},
 fr:{title:'Quel est votre point de départ ?',body:'Une description, une image ou un clip existant : choisissez le parcours adapté à votre projet.',cards:[['Texte-vers-vidéo','Décrivez une scène. Explorez les vidéos et leurs prompts.'],['Image-vers-vidéo','Animez une image avec un modèle compatible.'],['Vidéo-vers-vidéo','Vérifiez quels modèles acceptent des clips existants.']]},
 es:{title:'¿Con qué quieres empezar?',body:'Una descripción, una imagen o un clip existente: elige el proceso adecuado para tu proyecto.',cards:[['Texto a video','Describe una escena. Explora videos y prompts.'],['Imagen a video','Anima una imagen con un modelo compatible.'],['Video a video','Revisa qué modelos admiten clips existentes.']]},
};
const LINKS: LocalizedLinkHref[] = ['/examples',{pathname:'/ai-video-engines/best-for/[usecase]',params:{usecase:'image-to-video'}},'/models'];

export function WorkflowSeoSummary({ copy, locale }: { copy: WorkflowSeoSummaryCopy; locale: AppLocale }) {
 if (!copy.generateWays?.items?.length) return null;
 const c = COPY[locale];
 return <aside className="home-workflow-summary border-y border-hairline bg-surface py-6 sm:py-8">
  <div className="container-page max-w-[1280px]">
   <div><h2>{c.title}</h2><p>{c.body}</p></div>
   <dl>{c.cards.map(([title,body],index)=><div key={title}><dt><Link href={LINKS[index]}>{title} <span aria-hidden>↗</span></Link></dt><dd>{body}</dd></div>)}</dl>
  </div>
 </aside>;
}
