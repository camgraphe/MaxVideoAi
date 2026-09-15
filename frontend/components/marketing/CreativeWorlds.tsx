import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { CREATIVE_FILMS } from '@/components/marketing/creative-films';
import { CreativeFilm } from '@/components/marketing/CreativeFilm.client';

const COPY = {
 en: { eyebrow:'AI video examples', title:'Make something worth watching.',body:'A character. A feeling. A world that does not exist yet. Start with your idea and see how far it can go.',cta:'Browse all examples',play:'Watch the video',loading:'Loading…',error:'Try again',titles:['Beyond the ordinary.','Make movement an emotion.','Imagine another world.','Give your characters life.'],labels:['Cinema','Movement','Worlds & atmosphere','Animation'] },
 fr: { eyebrow:'Exemples de vidéos IA',title:'Créez ce qu’on a envie de regarder.',body:'Un personnage. Une émotion. Un monde qui n’existe pas encore. Partez d’une idée et voyez jusqu’où elle peut vous mener.',cta:'Voir tous les exemples',play:'Voir la vidéo',loading:'Chargement…',error:'Réessayer',titles:['Sortir de l’ordinaire.','Faire du mouvement une émotion.','Imaginer un autre monde.','Donner vie aux personnages.'],labels:['Cinéma','Mouvement','Univers & ambiances','Animation'] },
 es: { eyebrow:'Ejemplos de videos con IA',title:'Crea algo que den ganas de ver.',body:'Un personaje. Una emoción. Un mundo que todavía no existe. Empieza con tu idea y descubre hasta dónde puede llegar.',cta:'Ver todos los ejemplos',play:'Ver el video',loading:'Cargando…',error:'Reintentar',titles:['Salir de lo cotidiano.','Convertir movimiento en emoción.','Imaginar otro mundo.','Dar vida a tus personajes.'],labels:['Cine','Movimiento','Mundos y ambientes','Animación'] },
};
export function CreativeWorlds({locale, compact = false, children}:{locale:AppLocale; compact?:boolean; children?:ReactNode}) {
 const c=COPY[locale];
 return <section className={compact ? "creative-worlds creative-worlds-compact section" : "creative-worlds section"} id={compact ? undefined : "creations"}><div className="container-page">
  {!compact ? <header className="chapter-heading"><div><p className="editorial-eyebrow">{c.eyebrow}</p><h2>{c.title}</h2></div><div><p>{c.body}</p><Link href="/examples" className="text-link">{c.cta}<span aria-hidden>↗</span></Link></div></header> : null}
  <div className="creative-worlds-grid">{CREATIVE_FILMS.map((film,i)=><figure key={film.key}>
   <CreativeFilm {...film} title={c.titles[i]} playLabel={c.play} loadingLabel={c.loading} errorLabel={c.error}/>
   <figcaption><span><small>{c.labels[i]}</small><strong>{c.titles[i]}</strong></span><span>{compact ? film.model : <Link href={{pathname:"/models/[slug]",params:{slug:["minimax-h3-max","minimax-h3-max","gemini-omni-flash","kling-3-pro"][i]}}}>{film.model} <span aria-hidden>↗</span></Link>}</span></figcaption>
  </figure>)}</div>
  {children}
 </div></section>;
}
