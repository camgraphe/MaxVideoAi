import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { getToolDefinition } from '@/src/lib/toolbox/catalogue';
import { QUICK_TOOL_ART, WORKSHOP_ART } from '@/src/components/tools/toolbox-art';

const COPY = {
  en: { eyebrow: 'Shape the details', title: 'Make the scene your own.', body: 'Build your character, find a better angle, clean up an image. Prepare what your next video needs, right here.', cta: 'Explore all tools', note: 'Tool illustrations', names: ['Character Builder', 'Angle', 'AI Upscale', 'Background removal'], labels: ['Keep the same character', 'Change the camera angle', 'Bring out the detail', 'Remove the background'] },
  fr: { eyebrow: 'Travailler les détails', title: 'Composez la scène à votre façon.', body: 'Créez votre personnage, cherchez le bon angle, affinez une image. Préparez ici ce dont votre prochaine vidéo a besoin.', cta: 'Découvrir tous les outils', note: 'Illustrations des outils', names: ['Character Builder', 'Angle', 'AI Upscale', 'Détourage'], labels: ['Garder le même personnage', 'Changer l’angle de vue', 'Retrouver les détails', 'Supprimer l’arrière-plan'] },
  es: { eyebrow: 'Cuida los detalles', title: 'Dale tu toque a cada escena.', body: 'Crea tu personaje, busca el mejor ángulo y mejora una imagen. Prepara aquí lo que necesita tu próximo video.', cta: 'Explorar todas las herramientas', note: 'Ilustraciones de las herramientas', names: ['Character Builder', 'Angle', 'AI Upscale', 'Eliminación de fondo'], labels: ['Mantén el mismo personaje', 'Cambia el ángulo de cámara', 'Resalta los detalles', 'Elimina el fondo'] },
};

export function HomeToolsGallery({locale}: {locale:AppLocale}) {
  const copy = COPY[locale];
  const cards = [
    {key:'character', href:'/tools/character-builder', src:WORKSHOP_ART['character-builder']},
    {key:'angle', href:'/tools/angle', src:WORKSHOP_ART.angle},
    {key:'upscale', href:'/tools/upscale', src:QUICK_TOOL_ART['upscale-image']},
  ];
  const smallLabels = {
    en: ['Remove the background', 'Restore a video', 'Reduce noise', 'Fix motion blur', 'Smooth motion', 'Build a storyboard'],
    fr: ['Supprimer l’arrière-plan', 'Restaurer une vidéo', 'Réduire le bruit', 'Corriger le flou', 'Fluidifier le mouvement', 'Créer un storyboard'],
    es: ['Eliminar el fondo', 'Restaurar un video', 'Reducir el ruido', 'Corregir el desenfoque', 'Suavizar el movimiento', 'Crear un storyboard'],
  }[locale];
  const smallCards = [
    {key:'background-removal', href:'/tools/background-removal', src:QUICK_TOOL_ART['background-removal']},
    ...(['restore-video', 'denoise', 'fix-blur', 'smooth-motion'] as const).map(key => ({key, href:getToolDefinition(key)!.href, src:QUICK_TOOL_ART[key]})),
    {key:'storyboard', href:getToolDefinition('storyboard')!.href, src:WORKSHOP_ART.storyboard},
  ];
  return <section id="toolkit" className="home-tools-gallery section">
    <div className="container-page">
      <header className="chapter-heading"><div><p className="editorial-eyebrow">{copy.eyebrow}</p><h2>{copy.title}</h2></div><div><p>{copy.body}</p><Link href="/tools" className="text-link">{copy.cta}<span aria-hidden>↗</span></Link></div></header>
      <div className="home-tool-visuals">{cards.map((card,index) => <Link key={card.key} href={card.href} className="home-tool-visual" data-analytics-event="tool_card_click" data-analytics-cta-name={card.key} data-analytics-cta-location="toolbox" data-analytics-tool-name={card.key} data-analytics-tool-surface="public">
        <div><Image src={card.src} alt={copy.labels[index]} fill unoptimized sizes="(max-width: 700px) 78vw, 30vw" loading="lazy" /></div>
        <span><span><small>{copy.names[index]}</small><h3>{copy.labels[index]}</h3></span><span aria-hidden>↗</span></span>
      </Link>)}</div>
      <div className="home-tool-shortcuts">{smallCards.map((card, index) => <Link key={card.key} href={card.href} prefetch={false} className="home-tool-shortcut" data-analytics-event="tool_card_click" data-analytics-cta-name={card.key} data-analytics-cta-location="toolbox" data-analytics-tool-name={card.key} data-analytics-tool-surface="public">
        <Image src={card.src} alt="" aria-hidden="true" width={64} height={48} sizes="64px" loading="lazy"/>
        <span>{smallLabels[index]}</span><span aria-hidden>↗</span>
      </Link>)}</div>
      <p className="tool-gallery-note">{copy.note}</p>
    </div>
  </section>;
}
